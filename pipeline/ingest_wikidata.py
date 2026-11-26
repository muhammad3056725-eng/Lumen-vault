#!/usr/bin/env python3
"""LUMEN VAULT — Wikidata ingest.

Pulls WELL-KNOWN works from the Wikidata SPARQL endpoint and maps them onto
the entity schema. Quality gates:

  * ordered by sitelink count (how many Wikipedias cover the item) and
    filtered by --min-sitelinks, so only notable works enter;
  * notability_score is derived from sitelinks (not a constant);
  * pornographic / erotic films are excluded by genre;
  * items without an English label (labels that are bare QIDs) are dropped;
  * region comes from P495 country of origin only; items with an unmapped or
    missing country are skipped rather than guessed.

Curatorial facets (WON_OSCAR, SETTING_SPACE_SCIFI, ...) and sensory tags are
NOT invented here; they stay a human-curated layer in tools/seed.

Usage: python ingest_wikidata.py --limit 300 --min-sitelinks 40
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from pathlib import Path

import requests

SPARQL_URL = "https://query.wikidata.org/sparql"
USER_AGENT = "LumenVaultPipeline/0.2 (educational game data build)"

CLASSES = {
    "Q11424": "DOM_FILM",  # film
    "Q3305213": "DOM_ART",  # painting
    "Q7725634": "DOM_LITERATURE",  # literary work
    "Q7889": "DOM_VIDEO_GAMES",  # video game
}

# Genres never admitted (pornographic film, erotic film).
EXCLUDED_GENRES = ["Q185529", "Q860626"]

COUNTRY_REGION = {
    "Q30": "REG_NORTH_AMERICA", "Q16": "REG_NORTH_AMERICA", "Q96": "REG_NORTH_AMERICA",
    "Q145": "REG_EUROPE", "Q142": "REG_EUROPE", "Q183": "REG_EUROPE", "Q38": "REG_EUROPE",
    "Q29": "REG_EUROPE", "Q159": "REG_EUROPE", "Q15180": "REG_EUROPE", "Q55": "REG_EUROPE",
    "Q34": "REG_EUROPE", "Q20": "REG_EUROPE", "Q35": "REG_EUROPE", "Q33": "REG_EUROPE",
    "Q36": "REG_EUROPE", "Q213": "REG_EUROPE", "Q28": "REG_EUROPE", "Q27": "REG_EUROPE",
    "Q31": "REG_EUROPE", "Q39": "REG_EUROPE", "Q40": "REG_EUROPE", "Q41": "REG_EUROPE",
    "Q45": "REG_EUROPE", "Q212": "REG_EUROPE",
    "Q17": "REG_ASIA", "Q148": "REG_ASIA", "Q884": "REG_ASIA", "Q668": "REG_ASIA",
    "Q865": "REG_ASIA", "Q8646": "REG_ASIA", "Q869": "REG_ASIA", "Q252": "REG_ASIA",
    "Q928": "REG_ASIA", "Q881": "REG_ASIA",
    "Q155": "REG_SOUTH_AMERICA", "Q414": "REG_SOUTH_AMERICA", "Q298": "REG_SOUTH_AMERICA",
    "Q739": "REG_SOUTH_AMERICA", "Q419": "REG_SOUTH_AMERICA",
    "Q408": "REG_OCEANIA", "Q664": "REG_OCEANIA",
    "Q79": "REG_AFRICA", "Q258": "REG_AFRICA", "Q1033": "REG_AFRICA", "Q114": "REG_AFRICA",
    "Q1028": "REG_AFRICA",
    "Q801": "REG_MIDDLE_EAST", "Q43": "REG_MIDDLE_EAST", "Q794": "REG_MIDDLE_EAST",
    "Q851": "REG_MIDDLE_EAST", "Q878": "REG_MIDDLE_EAST", "Q822": "REG_MIDDLE_EAST",
}

QUERY = """
SELECT ?item ?itemLabel (MIN(?date) AS ?first) (SAMPLE(?country) AS ?origin) ?sitelinks WHERE {{
  ?item wdt:P31 wd:{cls} ;
        wdt:P577 ?date ;
        wdt:P495 ?country ;
        wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= {min_sitelinks})
  FILTER NOT EXISTS {{ ?item wdt:P136 ?g . VALUES ?g {{ {genres} }} }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
GROUP BY ?item ?itemLabel ?sitelinks
ORDER BY DESC(?sitelinks)
LIMIT {limit}
"""

BAD_LABEL = re.compile(r"^Q\d+$|\(.*disambiguation.*\)|^(List of|Category:)")


def notability_from_sitelinks(n: int) -> int:
    """Map sitelinks onto 60..99 (log scale): 40 -> 79, 100 -> 85, 400 -> 94."""
    return max(60, min(99, round(55 + 15 * math.log10(max(n, 1)))))


def fetch_class(session: requests.Session, cls: str, limit: int, min_sitelinks: int) -> list[dict]:
    query = QUERY.format(cls=cls, limit=limit, min_sitelinks=min_sitelinks, genres=" ".join(f"wd:{g}" for g in EXCLUDED_GENRES))
    resp = session.get(
        SPARQL_URL,
        params={"query": query, "format": "json"},
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        timeout=180,
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
    ap.add_argument("--min-sitelinks", type=int, default=40)
    ap.add_argument("--out", default=str(Path(__file__).parent / "out" / "raw_entities.json"))
    args = ap.parse_args()

    session = requests.Session()
    seen: set[str] = set()
    entities: list[dict] = []
    total = 0
    for cls, domain in CLASSES.items():
        try:
            rows = fetch_class(session, cls, args.limit, args.min_sitelinks)
        except requests.RequestException as exc:
            print(f"[ingest] class {cls}: REQUEST FAILED: {exc}", file=sys.stderr)
            continue
        total += len(rows)
        kept = 0
        for row in rows:
            label = (row.get("itemLabel") or {}).get("value", "").strip()
            qid = (row.get("item") or {}).get("value", "").rsplit("/", 1)[-1]
            year = parse_year((row.get("first") or {}).get("value", ""))
            country = ((row.get("origin") or {}).get("value", "") or "").rsplit("/", 1)[-1]
            sitelinks = int((row.get("sitelinks") or {}).get("value", "0"))
            region = COUNTRY_REGION.get(country)
            if not label or not qid or year is None or region is None or BAD_LABEL.search(label):
                continue
            key = f"{label.lower()}|{domain}"
            if key in seen:
                continue
            seen.add(key)
            entities.append(
                {
                    "wikidata_id": qid,
                    "canonical_title": label,
                    "aliases": [],
                    "era_year": year,
                    "region_id": region,
                    "primary_domain": domain,
                    "secondary_domain": None,
                    # Never SOLO by default — a wrong SOLO would poison CREATOR_SOLO rings.
                    "creator_type": "TEAM",
                    "notability_score": notability_from_sitelinks(sitelinks),
                    "sensory_tags": [],
                    "facets": [],
                }
            )
            kept += 1
        print(f"[ingest] class {cls} ({domain}): {len(rows)} rows -> {kept} kept")
        time.sleep(1)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entities, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"[ingest] total rows={total} entities kept={len(entities)} -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
