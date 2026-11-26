#!/usr/bin/env python3
"""LUMEN VAULT — facet tagging + corpus merge.

Derives the mechanical facets (same rules as tools/lib/seed.ts: DECADE_*,
CENTURY_*, PRE_1900, PRE_1950, ANCIENT_WORLD, TIMELESS, REGION_*, CREATOR_*,
DOMAIN_*, SENSE_*). Curatorial facets are never invented here.

Modes:
  (default)  tag a raw ingest file -> pipeline/out/wikidata_entities.json
  --merge    append NEW entities to tools/seed/ingested.json (deduplicated by
             normalized title + domain against the curated seed and earlier
             ingests; ids continue after the highest id in use, so repeated
             runs never collide). Then run `npm run data` to rebuild
             public/data/v1 — the curated seed is never overwritten.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SEED_DIR = REPO / "tools" / "seed" / "entities"
INGESTED = REPO / "tools" / "seed" / "ingested.json"
DOMAIN_CODES = {
    "FILM": "DOM_FILM", "LIT": "DOM_LITERATURE", "MUS": "DOM_MUSIC", "ART": "DOM_ART",
    "INV": "DOM_INVENTION", "SCI": "DOM_SCIENCE", "SPACE": "DOM_SPACE_EXPLORATION",
    "ENG": "DOM_ENGINEERING", "NAT": "DOM_NATURE", "ANI": "DOM_ANIMALS", "MYTH": "DOM_MYTHOLOGY",
    "GAME": "DOM_VIDEO_GAMES", "FOOD": "DOM_FOOD", "SPORT": "DOM_SPORT",
}


def normalize_title(title: str) -> str:
    s = unicodedata.normalize("NFKD", title)
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    s = re.sub(r"['’`´]", "", s)
    s = re.sub(r"[^\w\s]|_", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    words = s.split(" ")
    while len(words) > 1 and words[0] in ("the", "a", "an"):
        words.pop(0)
    return " ".join(words)


def derive_facets(e: dict) -> list[str]:
    facets = set(e.get("facets", []))
    y = e.get("era_year")
    if y is not None:
        if y < 500:
            facets.add("ANCIENT_WORLD")
        if y < 1900:
            facets.add("PRE_1900")
        if y < 1950:
            facets.add("PRE_1950")
        if 1800 <= y < 1900:
            facets.add("CENTURY_19TH")
        if 1900 <= y < 2000:
            facets.add("CENTURY_20TH")
        if 2000 <= y < 2100:
            facets.add("CENTURY_21ST")
        if 0 <= y < 2100:
            facets.add(f"DECADE_{(y // 10) * 10}S")
    else:
        facets.add("TIMELESS")
    facets.add(e["region_id"].replace("REG_", "REGION_"))
    facets.add(f"CREATOR_{e['creator_type']}")
    facets.add(e["primary_domain"].replace("DOM_", "DOMAIN_"))
    if e.get("secondary_domain"):
        facets.add(e["secondary_domain"].replace("DOM_", "DOMAIN_"))
    for t in e.get("sensory_tags", []):
        facets.add(f"SENSE_{t}")
    return sorted(facets)


def seed_index() -> tuple[set[tuple[str, str]], int, set[str]]:
    """(normalized title, domain) pairs, highest numeric id, wikidata ids already present."""
    keys: set[tuple[str, str]] = set()
    max_id = 0
    qids: set[str] = set()
    for path in sorted(SEED_DIR.glob("*.txt")):
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            max_id = max(max_id, int(parts[0]))
            dom = DOMAIN_CODES.get(parts[4].split("/")[0], parts[4])
            keys.add((normalize_title(parts[1]), dom))
    if INGESTED.exists():
        for e in json.loads(INGESTED.read_text(encoding="utf-8")):
            max_id = max(max_id, int(e["entity_id"].split("-")[1]))
            keys.add((normalize_title(e["canonical_title"]), e["primary_domain"]))
            if e.get("wikidata_id"):
                qids.add(e["wikidata_id"])
    return keys, max_id, qids


def tag_entities(raw: list[dict], start_index: int) -> list[dict]:
    tagged = []
    for i, e in enumerate(raw):
        rec = {
            "entity_id": f"E-{start_index + i}",
            "canonical_title": e["canonical_title"],
            "aliases": e.get("aliases", []),
            "era_year": e.get("era_year"),
            "region_id": e.get("region_id", "REG_GLOBAL"),
            "primary_domain": e["primary_domain"],
            "secondary_domain": e.get("secondary_domain"),
            "creator_type": e.get("creator_type", "TEAM"),
            "notability_score": e.get("notability_score", 70),
            "sensory_tags": e.get("sensory_tags", []),
            "facets": [],
            "wikidata_id": e.get("wikidata_id"),
        }
        rec["facets"] = derive_facets(rec)
        tagged.append(rec)
    return tagged


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw", default=str(Path(__file__).parent / "out" / "raw_entities.json"))
    ap.add_argument("--out", default=str(Path(__file__).parent / "out" / "wikidata_entities.json"))
    ap.add_argument("--merge", action="store_true", help="append new entities to tools/seed/ingested.json")
    args = ap.parse_args()

    raw = json.loads(Path(args.raw).read_text(encoding="utf-8"))
    keys, max_id, qids = seed_index()
    fresh = []
    for e in raw:
        key = (normalize_title(e["canonical_title"]), e["primary_domain"])
        if key in keys or (e.get("wikidata_id") and e["wikidata_id"] in qids):
            continue
        keys.add(key)
        fresh.append(e)
    start = max(10000, max_id + 1)
    tagged = tag_entities(fresh, start)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(tagged, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"[tag] {len(raw)} raw -> {len(tagged)} new tagged -> {out}")

    if args.merge:
        existing = json.loads(INGESTED.read_text(encoding="utf-8")) if INGESTED.exists() else []
        merged = existing + tagged
        INGESTED.write_text(json.dumps(merged, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"[merge] {len(existing)} ingested + {len(tagged)} new = {len(merged)} in {INGESTED}")
        print("[merge] now run `npm run data` to rebuild and re-prove public/data/v1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
