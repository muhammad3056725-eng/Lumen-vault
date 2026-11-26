/**
 * ConstraintVerifier + scoring economy (Blueprint §2 formulas, H3).
 *
 * H3 solvability proof, run over every generated chamber:
 *  - Venn: every tile's true region is computed deterministically;
 *    brainstorm sockets must accept >= 15 valid dictionary entities.
 *  - Chrono: gear years distinct (exactly 1 chronological order) and
 *    every clue plaque true.
 *  - Forge: the valid pool must hold at least `answersNeeded` answers.
 *  - Astrolabe: the answer's 4-attribute signature is unique among
 *    candidates and applying all filters leaves exactly the answer.
 *
 * Scoring (§2, verbatim):
 *  Chamber Mastery = Base_Solve (500)
 *                  + Logic_Precision_Bonus (up to 300, -50 per wrong placement)
 *                  + Creative_Spark_Bonus (up to 250, by rarity of brainstormed terms)
 *  Prisms_Earned = Floor(Flawless_Chambers / 1) + Floor(Rare_Brainstorm_Count / 2)
 */
import type {
  ChamberSpec,
  Entity,
} from "@lumen-vault/shared-types";
import { regionOf, satisfiesAllRings } from "./VennValidator.js";
import { solveChrono } from "./ChronoSolver.js";
import { applyFilters, attributeSignature, passesFilter } from "./AstrolabeFilter.js";
import { forgePool, isRare } from "./BrainstormEvaluator.js";

export const MIN_BRAINSTORM_ANSWERS = 15;

export interface ChamberProof {
  chamberId: string;
  ok: boolean;
  problems: string[];
  /** Diagnostic counts, reported honestly by the data pipeline. */
  stats: Record<string, number>;
}

export function verifyChamber(
  spec: ChamberSpec,
  entities: readonly Entity[]
): ChamberProof {
  const byId = new Map(entities.map((e) => [e.entity_id, e]));
  const problems: string[] = [];
  const stats: Record<string, number> = {};
  const need = (id: string) => {
    const e = byId.get(id);
    if (!e) problems.push(`Unknown entity ${id}`);
    return e;
  };

  switch (spec.kind) {
    case "venn": {
      const regions = new Set<number>();
      for (const tileId of spec.tiles) {
        const e = need(tileId);
        if (e) regions.add(regionOf(e, spec.rings));
      }
      stats.tiles = spec.tiles.length;
      stats.distinctRegions = regions.size;
      if (regions.size < 2) problems.push("All tiles share one region — no deduction needed");
      if (spec.brainstormSocket) {
        const valid = entities.filter((e) => satisfiesAllRings(e, spec.rings));
        stats.brainstormValidAnswers = valid.length;
        if (valid.length < MIN_BRAINSTORM_ANSWERS) {
          problems.push(
            `Brainstorm socket accepts ${valid.length} answers (< ${MIN_BRAINSTORM_ANSWERS} required by H3)`
          );
        }
      }
      break;
    }
    case "chrono": {
      const solution = solveChrono(spec, byId);
      stats.gears = spec.gears.length;
      problems.push(...solution.problems);
      break;
    }
    case "forge": {
      const pool = forgePool(spec, entities);
      stats.poolSize = pool.length;
      stats.poolRare = pool.filter(isRare).length;
      if (pool.length < spec.answersNeeded) {
        problems.push(`Forge pool has ${pool.length} answers (< ${spec.answersNeeded} needed)`);
      }
      break;
    }
    case "astrolabe": {
      const answer = need(spec.answer);
      spec.candidates.forEach(need);
      if (answer) {
        const signatures = spec.candidates.map((id) => attributeSignature(byId.get(id)!));
        const answerSig = attributeSignature(answer);
        stats.candidates = spec.candidates.length;
        stats.sameSignature = signatures.filter((s) => s === answerSig).length;
        if (stats.sameSignature !== 1) {
          problems.push("Answer's attribute signature is not unique among candidates");
        }
        spec.filters.forEach((f, i) => {
          if (!passesFilter(answer, f)) problems.push(`Answer fails its own filter ${i + 1}`);
        });
        const remaining = applyFilters(spec, byId, new Set(spec.filters.map((_, i) => i)));
        if (!(remaining.length === 1 && remaining[0] === spec.answer)) {
          problems.push(`Applying all filters leaves ${remaining.length} candidates, not exactly the answer`);
        }
      }
      break;
    }
  }
  return { chamberId: spec.id, ok: problems.length === 0, problems, stats };
}

export function verifyAllChambers(
  specs: readonly ChamberSpec[],
  entities: readonly Entity[]
): ChamberProof[] {
  return specs.map((s) => verifyChamber(s, entities));
}

/* ------------------------------------------------------------------ */
/* Scoring economy (Blueprint §2)                                      */
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
