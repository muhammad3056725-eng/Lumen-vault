/**
 * ConstraintVerifier + scoring economy + daily vault.
 *
 * Solvability proof, run over every chamber by the test suite, the data
 * builder and pipeline/verify_solvability.py (a Python mirror):
 *  - Venn: tiles distinct and known; ≥2 distinct regions (≥3 for three
 *    rings); sockets hold any number of tiles; brainstorm sockets accept
 *    ≥15 dictionary entities.
 *  - Chrono: distinct years, every plaque a fact, exactly one ordering
 *    from the plaques alone, no single plaque sufficient.
 *  - Forge: 3 runes; the valid pool holds ≥8 answers.
 *  - Astrolabe: see verifyAstrolabe (exactly one answer, no giveaway).
 *
 * Scoring:
 *  Chamber Mastery = 500 + Logic Precision (≤300, −50 per misstep)
 *                  + Creative Spark (≤250, by rarity of brainstormed terms)
 *  Stars = 3 − nudges − (any missteps ? 1 : 0), floor 1.
 */
import type { ChamberSpec, DailyVault, Entity } from "@lumen-vault/shared-types";
import { regionOf, satisfiesAllRings } from "./VennValidator.js";
import { solveChrono } from "./ChronoSolver.js";
import { verifyAstrolabe } from "./AstrolabeFilter.js";
import { forgePool, isRare, MIN_FORGE_POOL } from "./BrainstormEvaluator.js";
import { fnv1a } from "./random.js";

export const MIN_BRAINSTORM_ANSWERS = 15;

export interface ChamberProof {
  chamberId: string;
  ok: boolean;
  problems: string[];
  stats: Record<string, number>;
}

export function verifyChamber(spec: ChamberSpec, entities: readonly Entity[], byIdIn?: ReadonlyMap<string, Entity>): ChamberProof {
  const byId = byIdIn ?? new Map(entities.map((e) => [e.entity_id, e]));
  const problems: string[] = [];
  const stats: Record<string, number> = {};

  switch (spec.kind) {
    case "venn": {
      if (spec.rings.length < 2 || spec.rings.length > 3) problems.push("Venn needs 2 or 3 rings");
      if (new Set(spec.tiles).size !== spec.tiles.length) problems.push("Duplicate tiles");
      const regions = new Set<number>();
      for (const tileId of spec.tiles) {
        const e = byId.get(tileId);
        if (!e) problems.push(`Unknown tile ${tileId}`);
        else regions.add(regionOf(e, spec.rings));
      }
      stats.tiles = spec.tiles.length;
      stats.distinctRegions = regions.size;
      const minRegions = spec.rings.length === 3 ? 3 : 2;
      if (regions.size < minRegions) problems.push(`Tiles cover only ${regions.size} regions (< ${minRegions})`);
      if (spec.tiles.length < 4 || spec.tiles.length > 8) problems.push("Venn needs 4–8 tiles");
      if (spec.brainstormSocket) {
        if (spec.rings.length !== 3) problems.push("Brainstorm sockets are for three-ring chambers");
        const valid = entities.filter((e) => satisfiesAllRings(e, spec.rings));
        stats.brainstormValidAnswers = valid.length;
        if (valid.length < MIN_BRAINSTORM_ANSWERS) {
          problems.push(`Brainstorm socket accepts ${valid.length} answers (< ${MIN_BRAINSTORM_ANSWERS})`);
        }
      }
      break;
    }
    case "chrono": {
      stats.gears = spec.gears.length;
      stats.clues = spec.clues.length;
      if (spec.gears.length < 4 || spec.gears.length > 5) problems.push("Chrono needs 4 or 5 gears");
      if (new Set(spec.gears).size !== spec.gears.length) problems.push("Duplicate gears");
      problems.push(...solveChrono(spec, byId).problems);
      break;
    }
    case "forge": {
      if (spec.constraints.length !== 3) problems.push("Forge needs exactly 3 runes");
      const pool = forgePool(spec, entities);
      stats.poolSize = pool.length;
      stats.poolRare = pool.filter(isRare).length;
      if (pool.length < Math.max(MIN_FORGE_POOL, spec.answersNeeded)) {
        problems.push(`Forge pool has ${pool.length} answers (< ${MIN_FORGE_POOL})`);
      }
      break;
    }
    case "astrolabe": {
      stats.candidates = spec.candidates.length;
      stats.clues = spec.clues.length;
      if (spec.candidates.length < 6 || spec.candidates.length > 10) problems.push("Astrolabe needs 6–10 candidates");
      problems.push(...verifyAstrolabe(spec, byId));
      break;
    }
  }
  return { chamberId: spec.id, ok: problems.length === 0, problems, stats };
}

export function verifyAllChambers(specs: readonly ChamberSpec[], entities: readonly Entity[]): ChamberProof[] {
  const byId = new Map(entities.map((e) => [e.entity_id, e]));
  return specs.map((s) => verifyChamber(s, entities, byId));
}

/* ------------------------------------------------------------------ */
/* Scoring economy                                                     */
/* ------------------------------------------------------------------ */

export const BASE_SOLVE = 500;
export const MAX_PRECISION_BONUS = 300;
export const PRECISION_STEP = 50;
export const MAX_SPARK_BONUS = 250;

export function logicPrecisionBonus(wrongPlacements: number): number {
  return Math.max(0, MAX_PRECISION_BONUS - PRECISION_STEP * wrongPlacements);
}

/** Spark per brainstormed term: rarer (lower notability) burns brighter. */
export function sparkForTerm(entity: Entity): number {
  return Math.round((100 - entity.notability_score) * 1.25);
}

export function creativeSparkBonus(terms: readonly Entity[]): number {
  return Math.min(MAX_SPARK_BONUS, terms.reduce((sum, e) => sum + sparkForTerm(e), 0));
}

export function chamberMastery(wrongPlacements: number, brainstormTerms: readonly Entity[]): number {
  return BASE_SOLVE + logicPrecisionBonus(wrongPlacements) + creativeSparkBonus(brainstormTerms);
}

export function prismsEarned(flawlessChambers: number, rareBrainstormCount: number): number {
  return Math.floor(flawlessChambers / 1) + Math.floor(rareBrainstormCount / 2);
}

/** Stars for one chamber: 3, minus one per nudge, minus one if any misstep; never below 1. */
export function starsFor(wrong: number, nudges: number): number {
  return Math.max(1, Math.min(3, 3 - nudges - (wrong > 0 ? 1 : 0)));
}

/* ------------------------------------------------------------------ */
/* Daily Grand Vault — computed from the UTC date, no server needed    */
/* ------------------------------------------------------------------ */

export const DAILY_EPOCH = "2026-11-26"; // Daily #001

export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dailyNumber(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

/** The five pacing slots: warm-up Venn, 4-gear chain, forge, gilded Venn, astrolabe. */
export function dailySlots(chambers: readonly ChamberSpec[]): string[][] {
  const ids = (f: (c: ChamberSpec) => boolean) => chambers.filter(f).map((c) => c.id).sort();
  return [
    ids((c) => c.kind === "venn" && c.rings.length === 2),
    ids((c) => c.kind === "chrono" && c.gears.length === 4),
    ids((c) => c.kind === "forge"),
    ids((c) => c.kind === "venn" && c.rings.length === 3 && c.brainstormSocket),
    ids((c) => c.kind === "astrolabe"),
  ];
}

/** Deterministic daily vault for a UTC date (mirrored by pipeline/generate_chambers.py). */
export function dailyVaultFor(date: string, chambers: readonly ChamberSpec[]): DailyVault {
  const slots = dailySlots(chambers);
  const picked = slots.map((pool, i) => {
    if (pool.length === 0) throw new Error(`No eligible chamber for daily slot ${i + 1}`);
    return pool[fnv1a(`${date}:${i + 1}`) % pool.length];
  });
  return { date, number: dailyNumber(date), chambers: picked };
}
