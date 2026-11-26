#!/usr/bin/env python3
"""LUMEN VAULT — solvability verification (Blueprint H3).

Mirrors @packages/vault-engine's ConstraintVerifier over the shipped
dataset in public/data/v1. Runs two ways:

  * CLI:  python3 verify_solvability.py [--target daily.json]
          (without --target, verifies every chamber; with --target,
          verifies the chambers a daily vault references)
  * pytest: the blueprint CI runs `pytest verify_solvability.py`, so
          the checks below are also exposed as test_* functions.

Rules (H3): logic chambers yield exactly 1 correct configuration;
brainstorm keyholes accept >= 15 valid dictionary entities; forge
pools cover the answers needed; astrolabe answers are unique under
their 4-attribute signature and survive every filter.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data" / "v1"
MIN_BRAINSTORM_ANSWERS = 15


def era_bucket(y):
    if y is None:
        return None
    if y < 500:
        return "ANCIENT"
    if y < 1500:
        return "MEDIEVAL"
    if y < 1800:
        return "EARLY_MODERN"
    if y < 1900:
        return "NINETEENTH"
    if y < 2000:
        return "TWENTIETH"
    return "TWENTY_FIRST"


def load_data(data_dir: Path = DATA):
    entities = json.loads((data_dir / "entities.json").read_text())
    chambers = json.loads((data_dir / "chambers.json").read_text())
    return entities, {e["entity_id"]: e for e in entities}, chambers


def region_of(e, rings):
    mask = 0
    for i, ring in enumerate(rings):
        if ring["facet"] in e["facets"]:
            mask |= 1 << i
    return mask


def attr_of(e, attr):
    return {
        "region": e["region_id"],
        "era": era_bucket(e["era_year"]),
        "domain": e["primary_domain"],
        "creator": e["creator_type"],
    }[attr]


def forge_ok(e, c):
    if c["type"] == "SENSORY":
        return c["tag"] in e["sensory_tags"]
    if c["type"] == "DOMAIN":
        return e["primary_domain"] == c["domain"] or e.get("secondary_domain") == c["domain"]
    if c["type"] == "INITIALS":
        title = e["canonical_title"]
        for art in ("The ", "A ", "An "):
            if title.startswith(art):
                title = title[len(art):]
                break
        return title[:1].upper() in c["letters"]
    return False


def verify_chamber(spec, entities, by_id) -> list[str]:
    problems: list[str] = []
    kind = spec["kind"]
    if kind == "venn":
        regions = {region_of(by_id[t], spec["rings"]) for t in spec["tiles"]}
        if len(regions) < 2:
            problems.append("all tiles share one region")
        if spec.get("brainstormSocket"):
            full = (1 << len(spec["rings"])) - 1
            n = sum(1 for e in entities if region_of(e, spec["rings"]) == full)
            if n < MIN_BRAINSTORM_ANSWERS:
                problems.append(f"brainstorm answers {n} < {MIN_BRAINSTORM_ANSWERS}")
    elif kind == "chrono":
        gears = [by_id[g] for g in spec["gears"]]
        years = [g["era_year"] for g in gears]
        if any(y is None for y in years):
            problems.append("gear without year")
        if len(set(years)) != len(years):
            problems.append("gear years not distinct")
        for clue in spec["clues"]:
            t = clue["type"]
            ok = True
            if t == "GAP_YEARS":
                ok = years[clue["b"]] - years[clue["a"]] == clue["years"]
            elif t == "SAME_REGION":
                ok = gears[clue["a"]]["region_id"] == gears[clue["b"]]["region_id"]
            elif t == "BEFORE_YEAR_COUNT":
                ok = sum(1 for y in years if y < clue["year"]) == clue["count"]
            elif t == "IMMEDIATELY_BEFORE":
                ok = clue["b"] == clue["a"] + 1
            if not ok:
                problems.append(f"false clue: {clue}")
    elif kind == "forge":
        pool = [e for e in entities if all(forge_ok(e, c) for c in spec["constraints"])]
        if len(pool) < spec["answersNeeded"]:
            problems.append(f"forge pool {len(pool)} < {spec['answersNeeded']}")
    elif kind == "astrolabe":
        ans = by_id[spec["answer"]]
        sig = lambda e: "|".join(str(attr_of(e, a)) for a in ("region", "era", "domain", "creator"))
        sigs = [sig(by_id[c]) for c in spec["candidates"]]
        if sigs.count(sig(ans)) != 1:
            problems.append("answer signature not unique")
        def passes(e, f):
            eq = attr_of(e, f["attribute"]) == f["value"]
            return eq if f["keep"] else not eq
        for i, f in enumerate(spec["filters"]):
            if not passes(ans, f):
                problems.append(f"answer fails filter {i + 1}")
        remaining = [c for c in spec["candidates"] if all(passes(by_id[c], f) for f in spec["filters"])]
        if remaining != [spec["answer"]]:
            problems.append(f"filters leave {remaining}, not exactly the answer")
    return problems


def verify_all(data_dir: Path = DATA, only_ids: set[str] | None = None) -> dict[str, list[str]]:
    entities, by_id, chambers = load_data(data_dir)
    results = {}
    for spec in chambers:
        if only_ids and spec["id"] not in only_ids:
            continue
        results[spec["id"]] = verify_chamber(spec, entities, by_id)
    return results


# --- pytest entry points (Blueprint §6 CI: `pytest verify_solvability.py`) ---

def test_all_chambers_solvable():
    results = verify_all()
    bad = {k: v for k, v in results.items() if v}
    assert not bad, f"unsolvable chambers: {bad}"


def test_dataset_present():
    entities, _, chambers = load_data()
    assert len(entities) >= 100
    assert len(chambers) >= 16


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--target", help="a daily vault JSON; verify only its chambers")
    ap.add_argument("--data-dir", default=str(DATA))
    args = ap.parse_args()
    only = None
    if args.target:
        daily = json.loads(Path(args.target).read_text())
        only = set(daily["chambers"])
    results = verify_all(Path(args.data_dir), only)
    failed = 0
    for cid, problems in results.items():
        if problems:
            failed += 1
            print(f"FAIL {cid}: {'; '.join(problems)}")
        else:
            print(f"PASS {cid}")
    print(f"\n{len(results) - failed}/{len(results)} chambers verified")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
