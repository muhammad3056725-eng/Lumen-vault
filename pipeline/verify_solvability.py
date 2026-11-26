#!/usr/bin/env python3
"""LUMEN VAULT — solvability verification (Python mirror of the vault-engine proof).

Verifies every chamber in public/data/v1 (or only those of a daily vault):

  * Venn: tiles distinct and known; >=2 distinct regions (>=3 with three rings);
    any number of tiles may share a region socket; brainstorm sockets accept
    >=15 dictionary entities.
  * Chrono: distinct years; every plaque is a fact about the TRUE chronological
    positions; the plaques alone admit exactly one ordering; no single plaque
    is enough on its own.
  * Forge: three runes; the valid pool holds >=8 answers.
  * Astrolabe: every riddle is true of the answer and rules something out; no
    riddle alone leaves fewer than two candidates; all riddles together leave
    exactly the answer.

CLI:   python verify_solvability.py [--target daily.json] [--data-dir DIR]
pytest also collects the test_* functions below.
"""
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from itertools import permutations
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data" / "v1"
MIN_BRAINSTORM_ANSWERS = 15
MIN_FORGE_POOL = 8


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def era_bucket(y):
    if y is None:
        return "TIMELESS"
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
    entities = read_json(data_dir / "entities.json")
    chambers = read_json(data_dir / "chambers.json")
    return entities, {e["entity_id"]: e for e in entities}, chambers


def region_of(e, rings):
    mask = 0
    for i, ring in enumerate(rings):
        if ring["facet"] in e["facets"]:
            mask |= 1 << i
    return mask


def years_between(a: int, b: int) -> int:
    """Whole years from a to b; negative years are BCE and there is no year 0."""
    return b - a - (1 if a < 0 < b else 0)


def clue_holds(clue, order) -> bool:
    pos = order.index
    t = clue["type"]
    if t in ("BEFORE", "GAP_YEARS"):
        return pos(clue["a"]) < pos(clue["b"])
    if t == "IMMEDIATELY_BEFORE":
        return pos(clue["b"]) == pos(clue["a"]) + 1
    if t == "FIRST":
        return pos(clue["a"]) == 0
    if t == "LAST":
        return pos(clue["a"]) == len(order) - 1
    if t == "NOT_ADJACENT":
        return abs(pos(clue["a"]) - pos(clue["b"])) > 1
    if t == "BETWEEN":
        return pos(clue["a"]) < pos(clue["b"]) < pos(clue["c"])
    raise ValueError(f"unknown clue type {t}")


def count_orderings(gears, clues) -> int:
    return sum(1 for p in permutations(gears) if all(clue_holds(c, list(p)) for c in clues))


def attr_of(e, attr):
    return {
        "region": e["region_id"],
        "era": era_bucket(e["era_year"]),
        "domain": e["primary_domain"],
        "creator": e["creator_type"],
    }[attr]


def astro_holds(e, clue) -> bool:
    if clue["type"] == "YEAR":
        y = e["era_year"]
        if y is None:
            return False
        return y < clue["year"] if clue["op"] == "before" else y > clue["year"]
    eq = attr_of(e, clue["attribute"]) == clue["value"]
    return not eq if clue["negate"] else eq


def initial_of(title: str) -> str:
    for art in ("The ", "A ", "An "):
        if title.startswith(art):
            title = title[len(art):]
            break
    folded = "".join(ch for ch in unicodedata.normalize("NFKD", title) if not unicodedata.combining(ch))
    for ch in folded:
        if ch.isalnum():
            return ch.upper()
    return ""


def forge_ok(e, c) -> bool:
    t = c["type"]
    if t == "SENSORY":
        return c["tag"] in e["sensory_tags"]
    if t == "DOMAIN":
        return e["primary_domain"] == c["domain"] or e.get("secondary_domain") == c["domain"]
    if t == "FACET":
        return c["facet"] in e["facets"]
    if t == "INITIALS":
        return initial_of(e["canonical_title"]) in c["letters"]
    return False


def verify_chamber(spec, entities, by_id) -> list[str]:
    problems: list[str] = []
    kind = spec["kind"]
    if kind == "venn":
        tiles = spec["tiles"]
        if len(set(tiles)) != len(tiles):
            problems.append("duplicate tiles")
        unknown = [t for t in tiles if t not in by_id]
        if unknown:
            return problems + [f"unknown tiles {unknown}"]
        regions = {region_of(by_id[t], spec["rings"]) for t in tiles}
        need = 3 if len(spec["rings"]) == 3 else 2
        if len(regions) < need:
            problems.append(f"tiles cover only {len(regions)} regions")
        if not 4 <= len(tiles) <= 8:
            problems.append("venn needs 4-8 tiles")
        if spec.get("brainstormSocket"):
            full = (1 << len(spec["rings"])) - 1
            n = sum(1 for e in entities if region_of(e, spec["rings"]) == full)
            if n < MIN_BRAINSTORM_ANSWERS:
                problems.append(f"brainstorm answers {n} < {MIN_BRAINSTORM_ANSWERS}")
    elif kind == "chrono":
        gears = spec["gears"]
        if not 4 <= len(gears) <= 5:
            problems.append("chrono needs 4 or 5 gears")
        if any(g not in by_id for g in gears):
            return problems + ["unknown gear"]
        years = [by_id[g]["era_year"] for g in gears]
        if any(y is None for y in years):
            return problems + ["gear without year"]
        if len(set(years)) != len(years):
            problems.append("gear years not distinct")
        order = sorted(gears, key=lambda g: by_id[g]["era_year"])
        for i, clue in enumerate(spec["clues"]):
            ok = clue_holds(clue, order)
            if ok and clue["type"] == "GAP_YEARS":
                ok = years_between(by_id[clue["a"]]["era_year"], by_id[clue["b"]]["era_year"]) == clue["years"]
            if not ok:
                problems.append(f"clue {i + 1} is false: {clue}")
        if not problems:
            n = count_orderings(gears, spec["clues"])
            if n != 1:
                problems.append(f"plaques allow {n} orderings")
            for i, clue in enumerate(spec["clues"]):
                if count_orderings(gears, [clue]) == 1:
                    problems.append(f"clue {i + 1} alone solves the wheel")
    elif kind == "forge":
        if len(spec["constraints"]) != 3:
            problems.append("forge needs 3 runes")
        pool = [e for e in entities if all(forge_ok(e, c) for c in spec["constraints"])]
        if len(pool) < max(MIN_FORGE_POOL, spec["answersNeeded"]):
            problems.append(f"forge pool {len(pool)} < {MIN_FORGE_POOL}")
    elif kind == "astrolabe":
        cands = spec["candidates"]
        if spec["answer"] not in cands:
            return ["answer not on the dial"]
        if len(set(cands)) != len(cands):
            problems.append("duplicate candidates")
        if not 6 <= len(cands) <= 10:
            problems.append("astrolabe needs 6-10 candidates")
        ans = by_id[spec["answer"]]
        for i, c in enumerate(spec["clues"]):
            if not astro_holds(ans, c):
                problems.append(f"riddle {i + 1} false for the answer")
            left = [x for x in cands if astro_holds(by_id[x], c)]
            if len(left) == len(cands):
                problems.append(f"riddle {i + 1} rules nothing out")
            if len(left) < 2:
                problems.append(f"riddle {i + 1} alone gives the answer away")
        remaining = [x for x in cands if all(astro_holds(by_id[x], c) for c in spec["clues"])]
        if remaining != [spec["answer"]]:
            problems.append(f"riddles leave {remaining}, not exactly the answer")
        if len(spec["clues"]) < 3:
            problems.append("fewer than 3 riddles")
    else:
        problems.append(f"unknown kind {kind}")
    return problems


def verify_all(data_dir: Path = DATA, only_ids: set[str] | None = None) -> dict[str, list[str]]:
    entities, by_id, chambers = load_data(data_dir)
    results = {}
    for spec in chambers:
        if only_ids and spec["id"] not in only_ids:
            continue
        results[spec["id"]] = verify_chamber(spec, entities, by_id)
    return results


# --- pytest entry points ---

def test_all_chambers_solvable():
    bad = {k: v for k, v in verify_all().items() if v}
    assert not bad, f"unsolvable chambers: {bad}"


def test_dataset_present():
    entities, _, chambers = load_data()
    assert len(entities) >= 600
    assert len(chambers) >= 60


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--target", help="a daily vault JSON; verify only its chambers")
    ap.add_argument("--data-dir", default=str(DATA))
    args = ap.parse_args()
    only = None
    if args.target:
        only = set(read_json(Path(args.target))["chambers"])
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
