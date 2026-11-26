#!/usr/bin/env python3
"""LUMEN VAULT — facet tagging + corpus merge (Blueprint §5).

Derives the mechanical facets from entity fields (the same rules as
tools/build-data.mjs): DECADE_*, CENTURY_*, PRE_1900, PRE_1950,
ANCIENT_WORLD, REGION_* and CREATOR_*. Curatorial facets are never
derived — they only ever come from the curated seed.

Modes:
  (default)  tag a raw ingest file -> normalized entity list
  --merge    merge tagged entities into public/data/v1/entities.json
             (dedupe by normalized title; the curated seed always
             wins), refresh manifest counts + trie shards.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data" / "v1"


def normalize_title(title: str) -> str:
    s = unicodedata.normalize("NFKC", title).lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for art in ("the ", "a ", "an "):
        if s.startswith(art):
            s = s[len(art):]
            break
    return s


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
        if 0 <= y < 2030:
            facets.add(f"DECADE_{(y // 10) * 10}S")
    facets.add(e["region_id"].replace("REG_", "REGION_"))
    facets.add(f"CREATOR_{e['creator_type']}")
    return sorted(facets)


def tag_entities(raw: list[dict], start_index: int = 10000) -> list[dict]:
    tagged = []
    for i, e in enumerate(raw):
        tagged.append(
            {
                "entity_id": f"E-{start_index + i}",
                "canonical_title": e["canonical_title"],
                "aliases": e.get("aliases", []),
                "era_year": e.get("era_year"),
                "region_id": e.get("region_id", "REG_GLOBAL"),
                "primary_domain": e["primary_domain"],
                "secondary_domain": e.get("secondary_domain"),
                "creator_type": e.get("creator_type", "TEAM"),
                "notability_score": e.get("notability_score", 60),
                "sensory_tags": e.get("sensory_tags", []),
                "facets": derive_facets(e),
                "wikidata_id": e.get("wikidata_id"),
            }
        )
    return tagged


def refresh_manifest(entities: list[dict]) -> None:
    manifest_path = DATA / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    blob = json.dumps(entities, indent=1, ensure_ascii=False)
    (DATA / "entities.json").write_text(blob)
    manifest["entityCount"] = len(entities)
    manifest.setdefault("files", {})["entities.json"] = hashlib.sha256(blob.encode()).hexdigest()[:16]
    manifest["version"] = manifest.get("version", "1.0.0").split("+")[0] + f"+wd{len(entities)}"
    manifest_path.write_text(json.dumps(manifest, indent=1))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw", default=str(Path(__file__).parent / "out" / "raw_entities.json"))
    ap.add_argument("--out", default=str(Path(__file__).parent / "out" / "wikidata_entities.json"))
    ap.add_argument("--merge", action="store_true", help="merge into public/data/v1/entities.json")
    args = ap.parse_args()

    raw = json.loads(Path(args.raw).read_text())
    tagged = tag_entities(raw)
    Path(args.out).write_text(json.dumps(tagged, indent=1, ensure_ascii=False))
    print(f"[tag] {len(raw)} raw -> {len(tagged)} tagged -> {args.out}")

    if args.merge:
        current = json.loads((DATA / "entities.json").read_text())
        have = {normalize_title(e["canonical_title"]) for e in current}
        have_ids = {e.get("wikidata_id") for e in current if e.get("wikidata_id")}
        added = [
            e
            for e in tagged
            if normalize_title(e["canonical_title"]) not in have
            and e.get("wikidata_id") not in have_ids
        ]
        merged = current + added
        refresh_manifest(merged)
        print(f"[merge] {len(current)} existing + {len(added)} new = {len(merged)} entities in entities.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
