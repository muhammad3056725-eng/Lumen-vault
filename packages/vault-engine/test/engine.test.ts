import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { ArtifactCard, ChamberSpec, Entity, WingSpec } from "@lumen-vault/shared-types";
import {
  normalizeInput,
  containsProfanity,
  matchEntity,
  letterCount,
  regionOf,
  validatePlacements,
  satisfiesAllRings,
  solveChrono,
  validateArrangement,
  countOrderings,
  clueIsTrue,
  yearsBetween,
  generateChronoClues,
  remainingCandidates,
  verifyAstrolabe,
  evaluateForgeAnswer,
  forgePool,
  verifyAllChambers,
  chamberMastery,
  logicPrecisionBonus,
  creativeSparkBonus,
  prismsEarned,
  starsFor,
  renderShareCard,
  dailyVaultFor,
  dailyNumber,
  fnv1a,
  MIN_BRAINSTORM_ANSWERS,
  MIN_FORGE_POOL,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "public", "data", "v1");
const read = <T,>(f: string) => JSON.parse(readFileSync(join(dataDir, f), "utf8")) as T;
const entities = read<Entity[]>("entities.json");
const chambers = read<ChamberSpec[]>("chambers.json");
const wings = read<WingSpec[]>("wings.json");
const artifacts = read<ArtifactCard[]>("artifacts.json");
const byId = new Map(entities.map((e) => [e.entity_id, e]));
const idOf = (title: string, domain?: string) =>
  entities.find((e) => e.canonical_title === title && (!domain || e.primary_domain === domain))!.entity_id;

describe("normalize & matching", () => {
  test("NFKD folding, apostrophes, articles, numbers", () => {
    expect(normalizeInput("  The  MATRIX!! ")).toBe("matrix");
    expect(normalizeInput("ＷＡＬＬ－Ｅ")).toBe("wall e");
    expect(normalizeInput("Schindler's List")).toBe("schindlers list");
    expect(normalizeInput("Amélie")).toBe("amelie");
    expect(normalizeInput("Apollo Thirteen")).toBe("apollo 13");
    expect(normalizeInput("Street Fighter II")).toBe("street fighter 2");
  });
  test("profanity filter runs only after matching (Moby-Dick is a title)", () => {
    expect(matchEntity("Moby Dick", entities)?.entityId).toBe("E-0112");
    expect(matchEntity("shit", entities)).toBeNull();
    expect(containsProfanity(normalizeInput("what the shit"))).toBe(true);
  });
  test("canonical, alias, diacritics, apostrophes", () => {
    expect(matchEntity("JWST", entities)?.via).toBe("alias");
    expect(matchEntity("amelie", entities)?.entityId).toBe("E-0028");
    expect(matchEntity("schindlers list", entities)?.entityId).toBe(idOf("Schindler's List"));
    expect(matchEntity("interstelar", entities)?.entityId).toBe("E-0005");
  });
  test("token-subset partial matching", () => {
    expect(matchEntity("night music", entities)?.entityId).toBe(idOf("Eine kleine Nachtmusik"));
    expect(matchEntity("pyramids", entities)?.entityId).toBe(idOf("Pyramids of Giza"));
    expect(matchEntity("xyzzy nonsense", entities)).toBeNull();
  });
  test("acronyms need 3+ letters and 3+ word titles", () => {
    expect(matchEntity("me", entities)).toBeNull();
    expect(matchEntity("lotr", entities)).not.toBeNull();
  });
  test("same-title disambiguation by the chamber's constraints", () => {
    const novel = idOf("Dune", "DOM_LITERATURE");
    const film = idOf("Dune", "DOM_FILM");
    expect(matchEntity("Dune", entities, (id) => id === novel)?.entityId).toBe(novel);
    expect(matchEntity("Dune", entities, (id) => id === film)?.entityId).toBe(film);
    const mission = idOf("Apollo 13 Mission");
    expect(matchEntity("Apollo 13", entities, (id) => byId.get(id)!.primary_domain === "DOM_SPACE_EXPLORATION")?.entityId).toBe(mission);
  });
  test("letter count ignores spaces", () => {
    expect(letterCount("Blue Whale")).toBe(9);
  });
});

describe("dataset shape", () => {
  test("scale: ≥600 entities, ≥60 chambers, ≥15 per type, ≥6 wings", () => {
    expect(entities.length).toBeGreaterThanOrEqual(600);
    expect(chambers.length).toBeGreaterThanOrEqual(60);
    for (const k of ["venn", "chrono", "forge", "astrolabe"]) {
      expect(chambers.filter((c) => c.kind === k).length).toBeGreaterThanOrEqual(15);
    }
    expect(wings.length).toBeGreaterThanOrEqual(6);
  });
  test("every chamber sits in exactly one wing and has a unique artifact", () => {
    const inWings = wings.flatMap((w) => w.chambers);
    expect(new Set(inWings).size).toBe(inWings.length);
    expect([...inWings].sort()).toEqual(chambers.map((c) => c.id).sort());
    expect(artifacts.map((a) => a.chamberId).sort()).toEqual(chambers.map((c) => c.id).sort());
    expect(new Set(artifacts.map((a) => a.motif)).size).toBe(artifacts.length);
    for (const a of artifacts) expect(a.lore.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).length, a.lore).toBe(2);
  });
  test("entity ids unique; no domain dominates", () => {
    expect(new Set(entities.map((e) => e.entity_id)).size).toBe(entities.length);
    const film = entities.filter((e) => e.primary_domain === "DOM_FILM").length;
    expect(film / entities.length).toBeLessThan(0.2);
  });
  test("fact fixes: Hubble is an agency project; Toy Story has no competitive Oscar", () => {
    expect(byId.get("E-0047")!.creator_type).toBe("TEAM_GOVERNMENT_AGENCY");
    expect(byId.get("E-0003")!.facets).not.toContain("WON_OSCAR");
  });
});

describe("solvability proof over the shipped dataset", () => {
  const proofs = verifyAllChambers(chambers, entities);
  test("every chamber passes", () => {
    for (const p of proofs) expect(p.problems, `${p.chamberId}: ${p.problems.join("; ")}`).toEqual([]);
  });
  test("brainstorm sockets ≥15, forge pools ≥8", () => {
    for (const p of proofs) {
      if (p.stats.brainstormValidAnswers !== undefined) expect(p.stats.brainstormValidAnswers).toBeGreaterThanOrEqual(MIN_BRAINSTORM_ANSWERS);
      if (p.stats.poolSize !== undefined) expect(p.stats.poolSize).toBeGreaterThanOrEqual(MIN_FORGE_POOL);
    }
  });
});

describe("VennValidator", () => {
  const spec = chambers.find((c) => c.kind === "venn" && c.rings.length === 2)!;
  if (spec.kind !== "venn") throw new Error("kind");
  test("several tiles can share a region and still validate", () => {
    const correct = new Map(spec.tiles.map((id) => [id, regionOf(byId.get(id)!, spec.rings)]));
    const regions = [...correct.values()];
    expect(new Set(regions).size).toBeLessThan(regions.length); // a shared socket exists
    expect(validatePlacements(spec, byId, correct).allCorrect).toBe(true);
    const wrong = new Map(correct);
    wrong.set(spec.tiles[0], (correct.get(spec.tiles[0])! + 1) % 4);
    expect(validatePlacements(spec, byId, wrong).wrongCount).toBe(1);
  });
  test("satisfiesAllRings gates the brainstorm socket", () => {
    const b = chambers.find((c) => c.kind === "venn" && c.brainstormSocket)!;
    if (b.kind !== "venn") throw new Error("kind");
    const valid = entities.filter((e) => satisfiesAllRings(e, b.rings));
    expect(valid.length).toBeGreaterThanOrEqual(15);
  });
});

describe("ChronoSolver", () => {
  test("clues are checked against true positions, and pin exactly one order", () => {
    for (const c of chambers) {
      if (c.kind !== "chrono") continue;
      const sol = solveChrono(c, byId);
      expect(sol.valid, sol.problems.join("; ")).toBe(true);
      expect(countOrderings(c.gears, c.clues)).toBe(1);
      for (const clue of c.clues) {
        expect(clueIsTrue(clue, byId, sol.order)).toBe(true);
        expect(countOrderings(c.gears, [clue])).toBeGreaterThan(1);
      }
      expect(validateArrangement(sol, sol.order).correct).toBe(true);
      const swapped = [...sol.order];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      expect(validateArrangement(sol, swapped).misplacedCount).toBe(2);
    }
  });
  test("generator is deterministic and BCE gaps skip year 0", () => {
    const order = ["a", "b", "c", "d"];
    const years: Record<string, number> = { a: -500, b: 100, c: 1200, d: 1900 };
    const one = generateChronoClues(order, (id) => years[id], 42);
    expect(generateChronoClues(order, (id) => years[id], 42)).toEqual(one);
    expect(countOrderings(order, one)).toBe(1);
    expect(yearsBetween(-500, 100)).toBe(599);
  });
});

describe("Astrolabe deduction", () => {
  test("riddles leave exactly the answer; none is a giveaway", () => {
    for (const c of chambers) {
      if (c.kind !== "astrolabe") continue;
      expect(verifyAstrolabe(c, byId)).toEqual([]);
      expect(remainingCandidates(c.candidates, byId, c.clues)).toEqual([c.answer]);
      expect(c.candidates[0]).not.toBe(c.answer);
    }
  });
});

describe("Resonance Forge", () => {
  const spec = chambers.find((c) => c.kind === "forge")!;
  if (spec.kind !== "forge") throw new Error("kind");
  const pool = forgePool(spec, entities);
  test("accepts a pool answer, flags duplicates; unknown names never count as wrong", () => {
    const used = new Set<string>();
    const ok = evaluateForgeAnswer(pool[0].canonical_title, spec, entities, used, byId);
    expect(ok.accepted).toBe(true);
    used.add(ok.entity!.entity_id);
    const dup = evaluateForgeAnswer(pool[0].canonical_title, spec, entities, used, byId);
    expect(dup.duplicate).toBe(true);
    expect(dup.countsAsWrong).toBe(false);
    const unknown = evaluateForgeAnswer("Qwertyuiop the Movie", spec, entities, used, byId);
    expect(unknown.outcome).toBe("unknown");
    expect(unknown.countsAsWrong).toBe(false);
  });
  test("a known answer that breaks a rune counts as a misstep", () => {
    const breaker = entities.find((e) => !pool.includes(e))!;
    const res = evaluateForgeAnswer(breaker.canonical_title, spec, entities, new Set(), byId);
    expect(res.accepted).toBe(false);
    expect(res.countsAsWrong).toBe(true);
    expect(res.reason).toContain("breaks a rune");
  });
});

describe("Daily Grand Vault (client-side, rotates daily)", () => {
  test("deterministic, matches the Python mirror, follows the pacing curve", () => {
    const a = dailyVaultFor("2026-12-01", chambers);
    expect(dailyVaultFor("2026-12-01", chambers)).toEqual(a);
    expect(fnv1a("2026-12-01:1")).toBe(3318837882);
    expect(a.number).toBe(6);
    expect(dailyNumber("2026-11-26")).toBe(1);
    const kinds = a.chambers.map((id) => chambers.find((c) => c.id === id)!.kind);
    expect(kinds).toEqual(["venn", "chrono", "forge", "venn", "astrolabe"]);
    expect(dailyVaultFor("2026-12-02", chambers)).not.toEqual(a);
  });
});

describe("Scoring economy", () => {
  test("precision bonus and mastery", () => {
    expect(logicPrecisionBonus(0)).toBe(300);
    expect(logicPrecisionBonus(2)).toBe(200);
    expect(logicPrecisionBonus(9)).toBe(0);
    expect(chamberMastery(0, [])).toBe(800);
    const rare = byId.get("E-0024")!; // Solaris, notability 82
    expect(creativeSparkBonus([rare])).toBe(23);
    expect(prismsEarned(3, 5)).toBe(5);
  });
  test("stars: −1 per nudge, −1 for any misstep, floor 1", () => {
    expect(starsFor(0, 0)).toBe(3);
    expect(starsFor(2, 0)).toBe(2);
    expect(starsFor(0, 1)).toBe(2);
    expect(starsFor(1, 5)).toBe(1);
  });
});

describe("ShareCardRenderer", () => {
  test("notes state real nudges and missteps; lines never overflow", () => {
    const card = renderShareCard({
      dailyNumber: 42,
      cleared: 5,
      total: 5,
      timeSeconds: 252,
      score: 4850,
      prisms: 3,
      goldRun: false,
      chambers: [
        { kind: "venn", stars: 3, pathCode: "V2" },
        { kind: "chrono", stars: 2, wrong: 1, pathCode: "C4" },
        { kind: "forge", stars: 2, nudges: 1, pathCode: "F3" },
        { kind: "venn", stars: 1, nudges: 1, wrong: 2, pathCode: "V3" },
        { kind: "astrolabe", stars: 3, pathCode: "A9" },
      ],
    });
    expect(card).toContain("LUMEN VAULT DAILY #042 - 5/5 CHAMBERS CLEARED");
    expect(card).toContain("1 misstep");
    expect(card).toContain("1 nudge, 2 missteps");
    expect(card).toContain("[Master Vault]");
    const widths = new Set(card.split("\n").map((l) => l.length));
    expect(widths.size).toBe(1);
  });
});
