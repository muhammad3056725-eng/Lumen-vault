#!/usr/bin/env python3
"""LUMEN VAULT — trie shard compiler (Blueprint §5 layout).

Builds public/data/v1/trie_shards/<2-letter prefix>.json from
entities.json: lazy-loaded prefix shards for autocomplete, keyed by
the first two normalized characters of every title and alias.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data" / "v1"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def compile_shards(entities: list[dict]) -> dict[str, list[dict]]:
    shards: dict[str, list[dict]] = {}
    for e in entities:
        for name in [e["canonical_title"], *e.get("aliases", [])]:
            n = norm(name)
            if len(n) < 2:
                continue
            key = n[:2]
            entry = {"id": e["entity_id"], "t": e["canonical_title"], "p": n}
            bucket = shards.setdefault(key, [])
            if entry not in bucket:
                bucket.append(entry)
    return shards


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data-dir", default=str(DATA))
    args = ap.parse_args()
    data = Path(args.data_dir)
    entities = json.loads((data / "entities.json").read_text())
    shards = compile_shards(entities)
    out_dir = data / "trie_shards"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.json"):
        old.unlink()
    for key, entries in shards.items():
        (out_dir / f"{key}.json").write_text(json.dumps(entries, ensure_ascii=False))
    manifest_path = data / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        manifest["trieShards"] = len(shards)
        manifest_path.write_text(json.dumps(manifest, indent=1))
    print(f"[shards] {len(entities)} entities -> {len(shards)} trie shards")
    return 0


if __name__ == "__main__":
    sys.exit(main())
