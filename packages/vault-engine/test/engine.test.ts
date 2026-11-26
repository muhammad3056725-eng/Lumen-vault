import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { ChamberSpec, Entity } from "@lumen-vault/shared-types";
import {
  normalizeInput,
  containsProfanity,
  matchEntity,
  regionOf,
  validatePlacements,
  satisfiesAllRings,
  solveChrono,
  validateArrangement,
  clueHolds,
  applyFilters,
  evaluateForgeAnswer,
  forgePool,
  verifyAllChambers,
  chamberMastery,
  logicPrecisionBonus,
  creativeSparkBonus,
  prismsEarned,
  renderShareCard,
  MIN_BRAINSTORM_ANSWERS,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "public", "data", "v1");
const entities = JSON.parse(readFileSync(join(dataDir, "entities.json"), "utf8")) as Entity[];
const chambers = JSON.parse(readFileSync(join(dataDir, "chambers.json"), "utf8")) as ChamberSpec[];
const byId = new Map(entities.map((e) => [e.entity_id, e]));
const chamber = (id: string) => chambers.find((c) => c.id === id)!;

describe("normalize (H6/M3)", () => {
  test("NFKC, case, articles and punctuation", () => {
    expect(normalizeInput("  The  MATRIX!! ")).toBe("matrix");
    expect(normalizeInput("ＷＡＬＬ－Ｅ")).toBe("wall e");
    expect(normalizeInput("An American Tail")).toBe("american tail");
  });
  test("profanity is scrubbed", () => {
    expect(containsProfanity(normalizeInput("what the shit"))).toBe(true);
    expect(matchEntity("shit", entities)).toBeNull();
  });
  test("canonical, alias and acronym matching", () => {
    expect(matchEntity("apollo 13", entities)?.entityId).toBe(byId.get("E-0001")!.entity_id);
    expect(matchEntity("JWST", entities)?.via).toBe("alias");
    expect(matchEntity("the lord of the rings", entities)?.entityId).toBe("E-0110");
    // acronym: ISS -> International Space Station alias covers it
    expect(matchEntity("iss", entities)).not.toBeNull();
  });
  test("fuzzy tolerance: edit distance <= 1 for length >= 6", () => {
    expect(matchEntity("interstelar", entities)?.entityId).toBe("E-0005");
    expect(matchEntity("xyzzy nonsense", entities)).toBeNull();
  });
});

describe("H3 solvability proof over the shipped dataset", () => {
  const proofs = verifyAllChambers(chambers, entities);
  test("every chamber passes", () => {
    for (const p of proofs) {
      expect(p.problems, `${p.chamberId}: ${p.problems.join("; ")}`).toEqual([]);
      expect(p.ok).toBe(true);
    }
  });
  test("brainstorm socket accepts at least 15 answers", () => {
    const venn2 = proofs.find((p) => p.chamberId === "venn-02")!;
    expect(venn2.stats.brainstormValidAnswers).toBeGreaterThanOrEqual(MIN_BRAINSTORM_ANSWERS);
  });
  test("forge pools cover the answers needed", () => {
    for (const c of chambers.filter((c) => c.kind === "forge")) {
      if (c.kind !== "forge") continue;
      expect(forgePool(c, entities).length).toBeGreaterThanOrEqual(c.answersNeeded);
    }
  });
});

describe("VennValidator", () => {
  test("blueprint example: Apollo 13 sits in the triple intersection", () => {
    const spec = chamber("venn-03");
    if (spec.kind !== "venn") throw new Error("kind");
    expect(regionOf(byId.get("E-0001")!, spec.rings)).toBe(0b111);
    expect(regionOf(byId.get("E-0022")!, spec.rings)).toBe(0b100); // Oscar only (bit 2)
  });
  test("placement validation counts wrong tiles", () => {
    const spec = chamber("venn-01");
    if (spec.kind !== "venn") throw new Error("kind");
    const correct = new Map(spec.tiles.map((id) => [id, regionOf(byId.get(id)!, spec.rings)]));
    expect(validatePlacements(spec, byId, correct).allCorrect).toBe(true);
    const wrong = new Map(correct);
    wrong.set(spec.tiles[0], 0);
    const v = validatePlacements(spec, byId, wrong);
    expect(v.allCorrect).toBe(false);
    expect(v.wrongCount).toBeGreaterThanOrEqual(1);
  });
  test("satisfiesAllRings gates the brainstorm socket", () => {
    const spec = chamber("venn-02");
    if (spec.kind !== "venn") throw new Error("kind");
    expect(satisfiesAllRings(byId.get("E-0101")!, spec.rings)).toBe(true); // Starry Night
    expect(satisfiesAllRings(byId.get("E-0087")!, spec.rings)).toBe(false); // Eiffel (team)
  });
});

describe("ChronoSolver", () => {
  test("space race chain solves to Sputnik, Apollo, Voyager, JWST", () => {
    const spec = chamber("chrono-01");
    if (spec.kind !== "chrono") throw new Error("kind");
    const sol = solveChrono(spec, byId);
    expect(sol.valid).toBe(true);
    expect(sol.order).toEqual(["E-0049", "E-0046", "E-0045", "E-0048"]);
    expect(validateArrangement(sol, sol.order).correct).toBe(true);
    const swapped = [...sol.order];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(validateArrangement(sol, swapped).misplacedCount).toBe(2);
  });
  test("every shipped clue plaque is true", () => {
    for (const c of chambers) {
      if (c.kind !== "chrono") continue;
      const gears = c.gears.map((id) => byId.get(id)!);
      for (const clue of c.clues) expect(clueHolds(clue, gears)).toBe(true);
    }
  });
});

describe("AstrolabeFilter", () => {
  test("all filters leave exactly the Golden Record answer", () => {
    const spec = chamber("astro-01");
    if (spec.kind !== "astrolabe") throw new Error("kind");
    const all = new Set(spec.filters.map((_, i) => i));
    expect(applyFilters(spec, byId, all)).toEqual(["E-0045"]);
    expect(applyFilters(spec, byId, new Set()).length).toBe(spec.candidates.length);
  });
});

describe("BrainstormEvaluator (Resonance Forge)", () => {
  test("accepts a valid cold film, rejects duplicates and rune-breakers", () => {
    const spec = chamber("forge-01");
    if (spec.kind !== "forge") throw new Error("kind");
    const used = new Set<string>();
    const ok = evaluateForgeAnswer("frozen", spec, entities, used);
    expect(ok.accepted).toBe(true);
    used.add(ok.entity!.entity_id);
    expect(evaluateForgeAnswer("Frozen", spec, entities, used).duplicate).toBe(true);
    const bad = evaluateForgeAnswer("Titanic", spec, entities, used);
    expect(bad.accepted).toBe(false); // no COLD tag
    expect(bad.reason).toContain("breaks a rune");
  });
});

describe("Scoring economy (Blueprint §2 formulas)", () => {
  test("precision bonus: 300 flawless, -50 per wrong placement, floor 0", () => {
    expect(logicPrecisionBonus(0)).toBe(300);
    expect(logicPrecisionBonus(2)).toBe(200);
    expect(logicPrecisionBonus(9)).toBe(0);
  });
  test("chamber mastery = 500 + precision + spark (spark capped at 250)", () => {
    expect(chamberMastery(0, [])).toBe(800);
    const rare = byId.get("E-0024")!; // Solaris, notability 82
    expect(creativeSparkBonus([rare])).toBe(23);
    expect(chamberMastery(1, [rare])).toBe(500 + 250 + 23);
  });
  test("prism economy: 1 per flawless chamber + 1 per 2 rare brainstorms", () => {
    expect(prismsEarned(5, 0)).toBe(5);
    expect(prismsEarned(3, 5)).toBe(3 + 2);
    expect(prismsEarned(0, 1)).toBe(0);
  });
});

describe("ShareCardRenderer", () => {
  test("renders the blueprint's plain-text constellation card", () => {
    const card = renderShareCard({
      dailyNumber: 42,
      cleared: 5,
      total: 5,
      timeSeconds: 252,
      score: 4850,
      prisms: 3,
      goldRun: true,
      chambers: [
        { kind: "venn", stars: 3, pathCode: "A1" },
        { kind: "chrono", stars: 3, pathCode: "B2" },
        { kind: "forge", stars: 2, note: "1 Nudge", pathCode: "C1" },
        { kind: "astrolabe", stars: 3, pathCode: "D4" },
        { kind: "venn", stars: 3, note: "Rare Spark: \"Solaris\"", pathCode: "E0" },
      ],
    });
    expect(card).toContain("LUMEN VAULT DAILY #042 - 5/5 CHAMBERS CLEARED");
    expect(card).toContain("Time: 04:12 | Score: 4,850 | Insight Prisms: 3");
    expect(card).toContain("[Master Vault]");
    expect(card).toContain("Constellation Path: A1-B2-C1-D4-E0 [GOLD FLUID RUN]");
  });
});
