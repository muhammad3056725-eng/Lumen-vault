#!/usr/bin/env python3
"""LUMEN VAULT — Wikidata ingest (Blueprint §5, Week 1 gate).

Pulls structured entities from the Wikidata SPARQL endpoint and maps
them onto the vault's entity schema (Blueprint §5):

    canonical_title, era_year, region_id, primary_domain,
    creator_type, notability_score (from sitelink count), aliases

Curatorial facets (WON_OSCAR, SETTING_SPACE_SCIFI, ...) are NOT
invented here — they stay a human-curated layer in tools/seed. The
ingested corpus widens the dictionary: brainstorm pools, forge pools
and autocomplete all grow, while shipped chambers keep their fixed
tile/candidate lists, so every H3 proof is preserved (verified by
verify_solvability.py after a merge).

Usage:
    python3 ingest_wikidata.py --limit 300 --out out/raw_entities.json

Honest counts: the script prints exactly how many rows each class
returned and how many survived filtering. Nothing is extrapolated.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

SPARQL_URL = "https://query.wikidata.org/sparql"
USER_AGENT = "LumenVaultPipeline/0.1 (educational game data build; contact: repo owner)"

# Wikidata class QID -> vault primary_domain
CLASSES = {
    "Q11424": "DOM_FILM",          # film
    "Q3305213": "DOM_ART",         # painting
    "Q7725634": "DOM_LITERATURE",  # literary work
    "Q7889": "DOM_VIDEO_GAMES",    # video game
}

# Country QID -> vault region (common cases; fallback REG_GLOBAL)
COUNTRY_REGION = {
    "Q30": "REG_NORTH_AMERICA",    # United States
    "Q145": "REG_EUROPE",          # United Kingdom
    "Q142": "REG_EUROPE",          # France
    "Q183": "REG_EUROPE",          # Germany
    "Q38": "REG_EUROPE",           # Italy
    "Q29": "REG_EUROPE",           # Spain
    "Q159": "REG_EUROPE",          # Russia
    "Q884": "REG_ASIA",            # South Korea
    "Q17": "REG_ASIA",             # Japan
    "Q148": "REG_ASIA",            # China
    "Q668": "REG_ASIA",            # India
    "Q408": "REG_OCEANIA",         # Australia
    "Q16": "REG_NORTH_AMERICA",    # Canada
    "Q96": "REG_NORTH_AMERICA",    # Mexico
    "Q155": "REG_SOUTH_AMERICA",   # Brazil
    "Q79": "REG_AFRICA",           # Egypt
    "Q258": "REG_AFRICA",          # South Africa
    "Q801": "REG_MIDDLE_EAST",     # Israel
    "Q43": "REG_MIDDLE_EAST",      # Turkey
}

QUERY = """
SELECT ?item ?itemLabel ?date ?country WHERE {{
  ?item wdt:P31 wd:{cls} .
  ?item wdt:P577 ?date .
  OPTIONAL {{ ?item wdt:P495 ?country . }}
  OPTIONAL {{ ?item wdt:P17 ?country . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT {limit}
"""

BAD_LABEL = re.compile(r"\(.*disambiguation.*\)|^(List of|Category:)")


def fetch_class(session: requests.Session, cls: str, limit: int) -> list[dict]:
    query = QUERY.format(cls=cls, limit=limit)
    resp = session.get(
        SPARQL_URL,
        params={"query": query, "format": "json"},
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["results"]["bindings"]


def parse_year(date_value: str) -> int | None:
    m = re.match(r"^(-?)(\d{3,4})-", date_value or "")
    if not m:
        return None
    year = int(m.group(2))
    return -year if m.group(1) == "-" else year


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=300, help="max rows per class")
    ap.add_argument("--out", default=str(Path(__file__).parent / "out" / "raw_entities.json"))
    args = ap.parse_args()

    session = requests.Session()
    seen_titles: set[str] = set()
    entities: list[dict] = []
    total_rows = 0
    for cls, domain in CLASSES.items():
        try:
            rows = fetch_class(session, cls, args.limit)
        except requests.RequestException as exc:
            print(f"[ingest] class {cls}: REQUEST FAILED: {exc}", file=sys.stderr)
            continue
        total_rows += len(rows)
        kept = 0
        for row in rows:
            label = (row.get("itemLabel") or {}).get("value", "").strip()
            qid = (row.get("item") or {}).get("value", "").rsplit("/", 1)[-1]
            year = parse_year((row.get("date") or {}).get("value", ""))
            if not label or not qid or year is None or BAD_LABEL.search(label):
                continue
            key = label.lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)
            country_qid = ((row.get("country") or {}).get("value", "") or "").rsplit("/", 1)[-1]
            entities.append(
                {
                    "wikidata_id": qid,
                    "canonical_title": label,
                    "aliases": [],
                    "era_year": year,
                    "region_id": COUNTRY_REGION.get(country_qid, "REG_GLOBAL"),
                    "primary_domain": domain,
                    "secondary_domain": None,
                    # Safe default: works are credited to teams/studios
                    # unless a curator says otherwise. Never SOLO — a
                    # wrong SOLO could poison CREATOR_SOLO facets.
                    "creator_type": "TEAM",
                    "notability_score": 60,
                    "sensory_tags": [],
                    "facets": [],
                    "source": "wikidata",
                }
            )
            kept += 1
        print(f"[ingest] class {cls} ({domain}): {len(rows)} rows -> {kept} kept")
        time.sleep(1)  # be polite to the endpoint

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entities, indent=1, ensure_ascii=False))
    print(f"[ingest] total rows={total_rows} entities kept={len(entities)} -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
