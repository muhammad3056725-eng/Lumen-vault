/**
 * ChronoSolver (Blueprint §2 Chamber Type B).
 * The unique solution is the chronological order of the gear events.
 * The solver proves uniqueness (all years distinct) and verifies that
 * every engraved clue plaque states a truth about the data (H3).
 */
import type {
  ChronoChamberSpec,
  ChronoClue,
  Entity,
} from "@lumen-vault/shared-types";

export function clueHolds(
  clue: ChronoClue,
  gears: readonly Entity[]
): boolean {
  switch (clue.type) {
    case "GAP_YEARS": {
      const a = gears[clue.a]?.era_year;
      const b = gears[clue.b]?.era_year;
      return a !== null && a !== undefined && b !== null && b !== undefined && b - a === clue.years;
    }
    case "SAME_REGION":
      return gears[clue.a]?.region_id === gears[clue.b]?.region_id;
    case "BEFORE_YEAR_COUNT":
      return gears.filter((g) => g.era_year !== null && g.era_year < clue.year).length === clue.count;
    case "IMMEDIATELY_BEFORE":
      return clue.b === clue.a + 1;
  }
}

export function clueText(clue: ChronoClue, gears: readonly Entity[]): string {
  const name = (i: number) => gears[i]?.canonical_title ?? `Gear ${i + 1}`;
  switch (clue.type) {
    case "GAP_YEARS":
      return `${name(clue.b)} happened ${clue.years} years after ${name(clue.a)}`;
    case "SAME_REGION":
      return `${name(clue.a)} and ${name(clue.b)} share the same continent or region`;
    case "BEFORE_YEAR_COUNT":
      return `Exactly ${clue.count} of these happened before ${clue.year}`;
    case "IMMEDIATELY_BEFORE":
      return `${name(clue.b)} came immediately after ${name(clue.a)}`;
  }
}

export interface ChronoSolution {
  /** Gear entity ids in true chronological order. */
  order: string[];
  valid: boolean;
  problems: string[];
}

export function solveChrono(
  spec: ChronoChamberSpec,
  entities: ReadonlyMap<string, Entity>
): ChronoSolution {
  const problems: string[] = [];
  const gears = spec.gears.map((id) => {
    const e = entities.get(id);
    if (!e) problems.push(`Unknown gear entity ${id}`);
    return e;
  });
  const known = gears.filter((g): g is Entity => g !== undefined);
  const years = known.map((g) => g.era_year);
  if (years.some((y) => y === null)) problems.push("A gear has no era year");
  if (new Set(years).size !== years.length) {
    problems.push("Gear years are not distinct — chronological order is not unique");
  }
  spec.clues.forEach((clue, i) => {
    if (!clueHolds(clue, known)) problems.push(`Clue ${i + 1} is false: ${clueText(clue, known)}`);
  });
  const order = [...known]
    .sort((a, b) => (a.era_year ?? 0) - (b.era_year ?? 0))
    .map((g) => g.entity_id);
  return { order, valid: problems.length === 0, problems };
}

export interface ChronoValidation {
  correct: boolean;
  /** Positions whose occupant differs from the true order. */
  misplacedCount: number;
}

export function validateArrangement(
  solution: ChronoSolution,
  arrangedIds: readonly string[]
): ChronoValidation {
  let misplacedCount = 0;
  solution.order.forEach((id, i) => {
    if (arrangedIds[i] !== id) misplacedCount++;
  });
  return { correct: misplacedCount === 0, misplacedCount };
}
