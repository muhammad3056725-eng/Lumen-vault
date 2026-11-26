"""Pipeline integrity tests (CI gate)."""
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from generate_chambers import build_daily, fnv1a  # noqa: E402
from ingest_wikidata import BAD_LABEL, notability_from_sitelinks  # noqa: E402
from tag_facets import derive_facets, normalize_title, tag_entities  # noqa: E402
from verify_solvability import count_orderings, verify_all, years_between  # noqa: E402

DATA = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "v1"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def test_shipped_dataset_is_solvable():
    results = verify_all()
    assert all(not problems for problems in results.values()), results


def test_dataset_scale_and_wings():
    entities, chambers, wings, artifacts = load("entities.json"), load("chambers.json"), load("wings.json"), load("artifacts.json")
    assert len(entities) >= 600
    assert len(chambers) >= 60
    kinds = {}
    for c in chambers:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    assert all(kinds[k] >= 15 for k in ("venn", "chrono", "forge", "astrolabe"))
    assert len(wings) >= 6
    in_wings = [cid for w in wings for cid in w["chambers"]]
    assert sorted(in_wings) == sorted(c["id"] for c in chambers), "every chamber in exactly one wing"
    assert sorted(a["chamberId"] for a in artifacts) == sorted(c["id"] for c in chambers)
    assert len({a["motif"] for a in artifacts}) == len(artifacts)


def test_no_junk_entities():
    for e in load("entities.json"):
        assert not BAD_LABEL.search(e["canonical_title"]), e["canonical_title"]
    titles = {e["canonical_title"] for e in load("entities.json")}
    for bad in ("Pirates II: Stagnetti's Revenge", "Men of Israel", "Percy"):
        assert bad not in titles


def test_facet_derivation_matches_engine_rules():
    e = {"era_year": 1895, "region_id": "REG_EUROPE", "creator_type": "SOLO", "primary_domain": "DOM_SCIENCE",
         "sensory_tags": ["GLOWING"], "facets": ["WON_NOBEL"]}
    facets = derive_facets(e)
    for f in ("PRE_1900", "PRE_1950", "CENTURY_19TH", "DECADE_1890S", "REGION_EUROPE", "CREATOR_SOLO",
              "DOMAIN_SCIENCE", "SENSE_GLOWING", "WON_NOBEL"):
        assert f in facets
    assert "TIMELESS" in derive_facets({**e, "era_year": None})


def test_ingest_ids_never_collide_and_never_claim_solo():
    tagged = tag_entities([{"canonical_title": "Some Film", "primary_domain": "DOM_FILM", "era_year": 2001,
                            "region_id": "REG_ASIA", "creator_type": "TEAM"}], 10500)
    assert tagged[0]["entity_id"] == "E-10500"
    assert "CREATOR_SOLO" not in tagged[0]["facets"]


def test_ingest_quality_gates():
    assert BAD_LABEL.search("Q46551")
    assert not BAD_LABEL.search("Spirited Away")
    assert notability_from_sitelinks(40) < notability_from_sitelinks(400) <= 99


def test_daily_matches_the_client_algorithm():
    chambers = load("chambers.json")
    a = build_daily(chambers, date(2026, 12, 1))
    assert a == build_daily(chambers, date(2026, 12, 1))
    assert a["number"] == 6
    # Same FNV-1a value the TypeScript engine computes (packages/vault-engine/test).
    assert fnv1a("2026-12-01:1") == 3318837882
    by_id = {c["id"]: c for c in chambers}
    kinds = [by_id[cid]["kind"] for cid in a["chambers"]]
    assert kinds == ["venn", "chrono", "forge", "venn", "astrolabe"]
    assert len(by_id[a["chambers"][0]]["rings"]) == 2
    assert len(by_id[a["chambers"][1]]["gears"]) == 4
    assert by_id[a["chambers"][3]].get("brainstormSocket") is True
    assert build_daily(chambers, date(2026, 12, 2)) != a


def test_chrono_solver_and_bce_gaps():
    assert years_between(-100, 100) == 199  # no year 0
    assert years_between(1900, 1969) == 69
    clues = [{"type": "FIRST", "a": "x"}, {"type": "BEFORE", "a": "y", "b": "z"}]
    assert count_orderings(["x", "y", "z"], clues) == 1
    assert count_orderings(["x", "y", "z"], clues[:1]) == 2


def test_normalize_title_strips_articles_and_marks():
    assert normalize_title("The Matrix") == "matrix"
    assert normalize_title("Amélie") == "amelie"
    assert normalize_title("Schindler's List") == "schindlers list"
