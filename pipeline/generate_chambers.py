#!/usr/bin/env python3
"""LUMEN VAULT — Daily Grand Vault generator (Python mirror of the client).

The web client computes the daily vault itself from the UTC date, so no
workflow is needed for it to rotate. This script reproduces exactly the
same pick (FNV-1a over "<date>:<slot>") for tooling, previews and tests:

    Slot 1: 2-ring Venn (warm-up)
    Slot 2: 4-gear Chrono chain
    Slot 3: Resonance Forge
    Slot 4: 3-ring Venn with a brainstorm socket
    Slot 5: Deduction Astrolabe (finale)

Usage: python generate_chambers.py --mode daily [--date YYYY-MM-DD] [--out FILE]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data" / "v1"
EPOCH = date(2026, 11, 26)  # Daily #001


def fnv1a(text: str) -> int:
    h = 0x811C9DC5
    for byte in text.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def daily_slots(chambers: list[dict]) -> list[list[str]]:
    def ids(pred):
        return sorted(c["id"] for c in chambers if pred(c))

    return [
        ids(lambda c: c["kind"] == "venn" and len(c["rings"]) == 2),
        ids(lambda c: c["kind"] == "chrono" and len(c["gears"]) == 4),
        ids(lambda c: c["kind"] == "forge"),
        ids(lambda c: c["kind"] == "venn" and len(c["rings"]) == 3 and c.get("brainstormSocket")),
        ids(lambda c: c["kind"] == "astrolabe"),
    ]


def build_daily(chambers: list[dict], for_date: date) -> dict:
    seed = for_date.isoformat()
    picked = []
    for i, pool in enumerate(daily_slots(chambers)):
        if not pool:
            raise ValueError(f"no eligible chamber for daily slot {i + 1}")
        picked.append(pool[fnv1a(f"{seed}:{i + 1}") % len(pool)])
    number = max((for_date - EPOCH).days + 1, 1)
    return {"date": seed, "number": number, "chambers": picked}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mode", choices=["daily"], required=True)
    ap.add_argument("--date", help="YYYY-MM-DD (default: today, UTC)")
    ap.add_argument("--out", default=str(DATA / "daily" / "latest.json"))
    ap.add_argument("--data-dir", default=str(DATA))
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    chambers = json.loads((data_dir / "chambers.json").read_text(encoding="utf-8"))
    for_date = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else datetime.now(timezone.utc).date()
    daily = build_daily(chambers, for_date)

    sys.path.insert(0, str(Path(__file__).parent))
    from verify_solvability import verify_all

    bad = {k: v for k, v in verify_all(data_dir, set(daily["chambers"])).items() if v}
    if bad:
        print(f"[daily] REFUSING to publish — proof failed: {bad}", file=sys.stderr)
        return 1
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(daily, indent=1) + "\n", encoding="utf-8")
    print(f"[daily] {daily['date']} #{daily['number']:03d}: {' -> '.join(daily['chambers'])} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
