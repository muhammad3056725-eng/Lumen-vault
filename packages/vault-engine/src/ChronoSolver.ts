/**
 * ChronoSolver (Chamber Type B).
 * The answer is the chronological order of the gear events. Clues are
 * relational statements about the gears' TRUE chronological positions
 * (never about their order in the spec). The solver proves:
 *   - every gear has a distinct year (one true order),
 *   - every clue is a fact about that order,
 *   - the clues alone admit exactly one ordering (pure deduction), and
 *   - no single clue is enough on its own.
 */
import type { ChronoChamberSpec, ChronoClue, Entity } from "@lumen-vault/shared-types";
import { mulberry32, shuffleWith } from "./random.js";

type Names = (id: string) => string;

/** Whole years from a to b; negative years are BCE and there is no year 0. */
export function yearsBetween(a: number, b: number): number {
  return b - a - (a < 0 && b > 0 ? 1 : 0);
}

/** Does `clue` hold for a proposed ordering (array of ids, earliest first)? */
export function clueHoldsInOrder(clue: ChronoClue, order: readonly string[]): boolean {
  const pos = (id: string) => order.indexOf(id);
  switch (clue.type) {
    case "BEFORE":
    case "GAP_YEARS":
      return pos(clue.a) < pos(clue.b);
    case "IMMEDIATELY_BEFORE":
      return pos(clue.b) === pos(clue.a) + 1;
    case "FIRST":
      return pos(clue.a) === 0;
    case "LAST":
      return pos(clue.a) === order.length - 1;
    case "NOT_ADJACENT":
      return Math.abs(pos(clue.a) - pos(clue.b)) > 1;
    case "BETWEEN":
      return pos(clue.a) < pos(clue.b) && pos(clue.b) < pos(clue.c);
  }
}

/** Is the clue a true fact about the real years? */
export function clueIsTrue(clue: ChronoClue, byId: ReadonlyMap<string, Entity>, order: readonly string[]): boolean {
  if (clue.type === "GAP_YEARS") {
    const a = byId.get(clue.a)?.era_year;
    const b = byId.get(clue.b)?.era_year;
    if (a == null || b == null || yearsBetween(a, b) !== clue.years) return false;
  }
  return clueHoldsInOrder(clue, order);
}

export function clueText(clue: ChronoClue, name: Names): string {
  switch (clue.type) {
    case "BEFORE":
      return `${name(clue.a)} came before ${name(clue.b)}.`;
    case "IMMEDIATELY_BEFORE":
      return `${name(clue.b)} came right after ${name(clue.a)} — no gear between them.`;
    case "GAP_YEARS":
      return `${name(clue.b)} came ${clue.years} year${clue.years === 1 ? "" : "s"} after ${name(clue.a)}.`;
    case "FIRST":
      return `${name(clue.a)} is the oldest gear on this wheel.`;
    case "LAST":
      return `${name(clue.a)} is the most recent gear on this wheel.`;
    case "NOT_ADJACENT":
      return `${name(clue.a)} and ${name(clue.b)} are not neighbours in time.`;
    case "BETWEEN":
      return `${name(clue.b)} came after ${name(clue.a)} but before ${name(clue.c)}.`;
  }
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((x, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

/** Number of orderings of `gears` consistent with every clue. */
export function countOrderings(gears: readonly string[], clues: readonly ChronoClue[]): number {
  let n = 0;
  for (const p of permutations(gears)) if (clues.every((c) => clueHoldsInOrder(c, p))) n++;
  return n;
}

export interface ChronoSolution {
  /** Gear entity ids in true chronological order. */
  order: string[];
  valid: boolean;
  problems: string[];
}

export function solveChrono(spec: ChronoChamberSpec, entities: ReadonlyMap<string, Entity>): ChronoSolution {
  const problems: string[] = [];
  const gears = spec.gears.map((id) => {
    const e = entities.get(id);
    if (!e) problems.push(`Unknown gear entity ${id}`);
    return e;
  });
  const known = gears.filter((g): g is Entity => g !== undefined);
  const years = known.map((g) => g.era_year);
  if (years.some((y) => y === null)) problems.push("A gear has no era year");
  if (new Set(years).size !== years.length) problems.push("Gear years are not distinct — chronological order is not unique");
  const order = [...known].sort((a, b) => (a.era_year ?? 0) - (b.era_year ?? 0)).map((g) => g.entity_id);
  const name = (id: string) => entities.get(id)?.canonical_title ?? id;
  spec.clues.forEach((clue, i) => {
    const ids = [clue.a, "b" in clue ? clue.b : undefined, "c" in clue ? clue.c : undefined].filter(Boolean) as string[];
    if (ids.some((id) => !spec.gears.includes(id))) problems.push(`Clue ${i + 1} names a gear that is not on the wheel`);
    else if (!clueIsTrue(clue, entities, order)) problems.push(`Clue ${i + 1} is false: ${clueText(clue, name)}`);
  });
  if (problems.length === 0) {
    const count = countOrderings(spec.gears, spec.clues);
    if (count !== 1) problems.push(`The plaques allow ${count} orderings, not exactly one`);
    spec.clues.forEach((clue, i) => {
      if (countOrderings(spec.gears, [clue]) === 1) problems.push(`Clue ${i + 1} alone solves the wheel`);
    });
  }
  return { order, valid: problems.length === 0, problems };
}

export interface ChronoValidation {
  correct: boolean;
  /** Positions whose occupant differs from the true order. */
  misplacedCount: number;
}

export function validateArrangement(solution: ChronoSolution, arrangedIds: readonly (string | null)[]): ChronoValidation {
  let misplacedCount = 0;
  solution.order.forEach((id, i) => {
    if (arrangedIds[i] !== id) misplacedCount++;
  });
  return { correct: misplacedCount === 0, misplacedCount };
}

/**
 * Generate a minimal clue set that pins down `order` uniquely.
 * Deterministic for a given seed. Throws when no unique set exists.
 */
export function generateChronoClues(
  order: readonly string[],
  yearOf: (id: string) => number,
  seed: number
): ChronoClue[] {
  const rng = mulberry32(seed);
  const n = order.length;
  const pool: ChronoClue[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = order[i];
      const b = order[j];
      const gap = yearsBetween(yearOf(a), yearOf(b));
      pool.push({ type: "GAP_YEARS", a, b, years: gap });
      pool.push({ type: "BEFORE", a, b });
      if (j === i + 1) pool.push({ type: "IMMEDIATELY_BEFORE", a, b });
      if (j > i + 1) pool.push({ type: "NOT_ADJACENT", a, b });
      for (let k = j + 1; k < n; k++) pool.push({ type: "BETWEEN", a, b, c: order[k] });
    }
  }
  pool.push({ type: "FIRST", a: order[0] });
  pool.push({ type: "LAST", a: order[n - 1] });
  const ids = order.slice();
  for (let attempt = 0; attempt < 40; attempt++) {
    const shuffled = shuffleWith(pool, rng);
    // Lead with one year-gap plaque so every wheel has a dash of history.
    const gapFirst = shuffled.findIndex((c) => c.type === "GAP_YEARS" && c.years > 0);
    if (gapFirst > 0) shuffled.unshift(...shuffled.splice(gapFirst, 1));
    const chosen: ChronoClue[] = [];
    let count = countOrderings(ids, chosen);
    for (const clue of shuffled) {
      if (count === 1) break;
      if (countOrderings(ids, [clue]) === 1) continue; // never a one-clue giveaway
      const next = countOrderings(ids, [...chosen, clue]);
      if (next < count) {
        chosen.push(clue);
        count = next;
      }
    }
    if (count !== 1) continue;
    // Prune redundant plaques (keep the first gap clue if possible).
    for (let i = chosen.length - 1; i >= 0; i--) {
      const without = chosen.filter((_, k) => k !== i);
      if (without.length >= 2 && countOrderings(ids, without) === 1) chosen.splice(i, 1);
    }
    if (chosen.length >= 2) return chosen;
  }
  throw new Error(`Could not generate unique chrono clues for ${order.join(",")}`);
}
