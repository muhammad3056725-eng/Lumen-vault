#!/usr/bin/env python3
"""LUMEN VAULT — chamber generation (Blueprint §6 daily-vault workflow).

--mode daily: builds the Daily Grand Vault for a date, following the
M1 pacing curve:
    Chamber 1: 2-Ring Venn Logic        (~35s warm-up)
    Chamber 2: 4-Gear Chrono Chain      (~50s)
    Chamber 3: Resonance Forge          (~45s)
    Chamber 4: 3-Ring Venn + Brainstorm (~65s)
    Chamber 5: Deduction Astrolabe      (~60s finale)
Selection among eligible chambers is seeded by the date, so every
player worldwide gets the same vault (and reruns are reproducible).
Every emitted vault must pass verify_solvability.py — the generator
refuses to write a vault that fails its own proof.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data" / "v1"
EPOCH = date(2026, 11, 26)  # Daily #001 — launch day


def pick(candidates: list[str], seed: str, slot: str) -> str:
    if not candidates:
        raise ValueError(f"no eligible chamber for slot {slot}")
    digest = hashlib.sha256(f"{seed}:{slot}".encode()).hexdigest()
    return candidates[int(digest[:8], 16) % len(candidates)]


def build_daily(chambers: list[dict], for_date: date) -> dict:
    seed = for_date.isoformat()
    venn2 = [c["id"] for c in chambers if c["kind"] == "venn" and len(c["rings"]) == 2]
    chrono4 = [c["id"] for c in chambers if c["kind"] == "chrono" and len(c["gears"]) == 4]
    forge = [c["id"] for c in chambers if c["kind"] == "forge"]
    venn3 = [
        c["id"]
        for c in chambers
        if c["kind"] == "venn" and len(c["rings"]) == 3 and c.get("brainstormSocket")
    ]
    astro = [c["id"] for c in chambers if c["kind"] == "astrolabe"]
    ids = [
        pick(venn2, seed, "1"),
        pick(chrono4, seed, "2"),
        pick(forge, seed, "3"),
        pick(venn3, seed, "4"),
        pick(astro, seed, "5"),
    ]
    number = (for_date - EPOCH).days + 1
    return {"date": seed, "number": max(number, 1), "chambers": ids}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mode", choices=["daily"], required=True)
    ap.add_argument("--date", help="YYYY-MM-DD (default: today, UTC)")
    ap.add_argument("--out", default=str(DATA / "daily" / "latest.json"))
    ap.add_argument("--data-dir", default=str(DATA))
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    chambers = json.loads((data_dir / "chambers.json").read_text())
    for_date = (
        datetime.strptime(args.date, "%Y-%m-%d").date()
        if args.date
        else datetime.now(timezone.utc).date()
    )
    daily = build_daily(chambers, for_date)

    # Self-proof: never publish an unverified vault.
    sys.path.insert(0, str(Path(__file__).parent))
    from verify_solvability import verify_all

    results = verify_all(data_dir, set(daily["chambers"]))
    bad = {k: v for k, v in results.items() if v}
    if bad:
        print(f"[daily] REFUSING to publish — proof failed: {bad}", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(daily, indent=1))
    print(f"[daily] {daily['date']} #{daily['number']:03d}: {' -> '.join(daily['chambers'])} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
