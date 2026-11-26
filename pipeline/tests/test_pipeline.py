"""Pipeline integrity tests (Blueprint §6 CI gate)."""
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from compile_shards import compile_shards  # noqa: E402
from generate_chambers import build_daily  # noqa: E402
from tag_facets import derive_facets, normalize_title, tag_entities  # noqa: E402
from verify_solvability import verify_all  # noqa: E402

DATA = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "v1"


def test_shipped_dataset_is_solvable():
    results = verify_all()
    assert all(not problems for problems in results.values()), results


def test_facet_derivation_matches_engine_rules():
    e = {
        "era_year": 1895,
        "region_id": "REG_EUROPE",
        "creator_type": "SOLO",
        "facets": ["WON_NOBEL"],
    }
    facets = derive_facets(e)
    assert "PRE_1900" in facets and "PRE_1950" in facets
    assert "CENTURY_19TH" in facets and "DECADE_1890S" in facets
    assert "REGION_EUROPE" in facets and "CREATOR_SOLO" in facets
    assert "WON_NOBEL" in facets  # curatorial facets preserved, never invented


def test_ingest_defaults_never_claim_solo():
    tagged = tag_entities(
        [
            {
                "canonical_title": "Some Film",
                "primary_domain": "DOM_FILM",
                "era_year": 2001,
                "region_id": "REG_ASIA",
                "creator_type": "TEAM",
            }
        ]
    )
    assert "CREATOR_SOLO" not in tagged[0]["facets"]
    assert "DECADE_2000S" in tagged[0]["facets"]


def test_daily_generation_is_deterministic_and_follows_m1():
    chambers = json.loads((DATA / "chambers.json").read_text())
    a = build_daily(chambers, date(2026, 12, 1))
    b = build_daily(chambers, date(2026, 12, 1))
    assert a == b
    assert a["number"] == 6
    by_id = {c["id"]: c for c in chambers}
    kinds = [by_id[cid]["kind"] for cid in a["chambers"]]
    assert kinds == ["venn", "chrono", "forge", "venn", "astrolabe"]
    assert len(by_id[a["chambers"][0]]["rings"]) == 2
    assert len(by_id[a["chambers"][1]]["gears"]) == 4
    assert by_id[a["chambers"][3]].get("brainstormSocket") is True


def test_trie_shards_cover_titles():
    entities = json.loads((DATA / "entities.json").read_text())
    shards = compile_shards(entities)
    assert len(shards) > 50
    assert any(entry["t"] == "Voyager 1" for entry in shards["vo"])


def test_normalize_title_strips_articles():
    assert normalize_title("The Matrix") == "matrix"
    assert normalize_title("An American Tail") == "american tail"
