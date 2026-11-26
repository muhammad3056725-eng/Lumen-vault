/**
 * Astrolabe deduction (Chamber Type D).
 * The dial shows candidate names only. Riddle plaques are TRUE
 * statements about the hidden artifact (region, era, field, maker,
 * year). The player reasons which candidates each riddle rules out.
 * The verifier proves: all riddles fit the answer, together they leave
 * exactly the answer, every riddle rules something out, and no single
 * riddle is enough on its own.
 */
import {
  eraBucket,
  type AstrolabeAttribute,
  type AstrolabeChamberSpec,
  type AstrolabeClue,
  type Entity,
} from "@lumen-vault/shared-types";
import { mulberry32, shuffleWith } from "./random.js";

export const TIMELESS = "TIMELESS";

export function attributeOf(entity: Entity, attribute: AstrolabeAttribute): string {
  switch (attribute) {
    case "region":
      return entity.region_id;
    case "era":
      return eraBucket(entity.era_year) ?? TIMELESS;
    case "domain":
      return entity.primary_domain;
    case "creator":
      return entity.creator_type;
  }
}

export function astroClueHolds(entity: Entity, clue: AstrolabeClue): boolean {
  if (clue.type === "YEAR") {
    if (entity.era_year === null) return false;
    return clue.op === "before" ? entity.era_year < clue.year : entity.era_year > clue.year;
  }
  const equal = attributeOf(entity, clue.attribute) === clue.value;
  return clue.negate ? !equal : equal;
}

/** Candidates consistent with the given riddles. */
export function remainingCandidates(
  candidates: readonly string[],
  byId: ReadonlyMap<string, Entity>,
  clues: readonly AstrolabeClue[]
): string[] {
  return candidates.filter((id) => {
    const e = byId.get(id);
    if (!e) throw new Error(`Unknown candidate entity ${id}`);
    return clues.every((c) => astroClueHolds(e, c));
  });
}

/** Index of the first riddle that rules this entity out, or -1. */
export function firstBrokenClue(entity: Entity, clues: readonly AstrolabeClue[]): number {
  return clues.findIndex((c) => !astroClueHolds(entity, c));
}

/* ---------------- labels ---------------- */

export const REGION_NAME: Record<string, string> = {
  REG_EUROPE: "Europe",
  REG_NORTH_AMERICA: "North America",
  REG_SOUTH_AMERICA: "South America",
  REG_ASIA: "Asia",
  REG_AFRICA: "Africa",
  REG_OCEANIA: "Oceania",
  REG_MIDDLE_EAST: "the Middle East",
  REG_GLOBAL: "no single region (it spans the globe)",
};

export const ERA_NAME: Record<string, string> = {
  ANCIENT: "the ancient world (before 500 CE)",
  MEDIEVAL: "the medieval age (500–1499)",
  EARLY_MODERN: "the early modern age (1500–1799)",
  NINETEENTH: "the nineteenth century",
  TWENTIETH: "the twentieth century",
  TWENTY_FIRST: "the twenty-first century",
  TIMELESS: "no date at all — it is timeless",
};

export const DOMAIN_NAME: Record<string, string> = {
  DOM_FILM: "a film",
  DOM_LITERATURE: "a work of literature",
  DOM_MUSIC: "a work of music",
  DOM_ART: "a work of visual art",
  DOM_INVENTION: "an invention",
  DOM_SCIENCE: "a scientific discovery",
  DOM_SPACE_EXPLORATION: "a feat of space exploration",
  DOM_ENGINEERING: "a work of architecture or engineering",
  DOM_NATURE: "a wonder of nature",
  DOM_ANIMALS: "an animal",
  DOM_MYTHOLOGY: "a figure of myth",
  DOM_VIDEO_GAMES: "a video game",
  DOM_FOOD: "a food or drink",
  DOM_SPORT: "a sporting event",
};

export const CREATOR_TRUE: Record<string, string> = {
  SOLO: "Its maker worked alone",
  DUO: "It was made by a pair",
  TEAM: "A whole team made it",
  TEAM_GOVERNMENT_AGENCY: "A government agency built it",
  NATURE: "Nature made it — no human hand",
  TRADITIONAL: "It grew from tradition, with no single maker",
};

export const CREATOR_FALSE: Record<string, string> = {
  SOLO: "It was not the work of one person alone",
  DUO: "It was not made by a pair",
  TEAM: "It was not made by an ordinary team",
  TEAM_GOVERNMENT_AGENCY: "No government agency built it",
  NATURE: "Human hands shaped it",
  TRADITIONAL: "It is not a product of anonymous human tradition",
};

export function attributeClueText(attribute: AstrolabeAttribute, value: string, negate: boolean): string {
  switch (attribute) {
    case "region":
      if (value === "REG_GLOBAL") return negate ? "It belongs to one particular region of the world" : "It belongs to no single region — it spans the globe";
      return negate ? `It does not come from ${REGION_NAME[value]}` : `It comes from ${REGION_NAME[value]}`;
    case "era":
      if (value === TIMELESS) return negate ? "It has a date in history" : "It has no date at all — it is timeless";
      return negate ? `It does not belong to ${ERA_NAME[value]}` : `It belongs to ${ERA_NAME[value]}`;
    case "domain":
      return negate ? `It is not ${DOMAIN_NAME[value] ?? value}` : `It is ${DOMAIN_NAME[value] ?? value}`;
    case "creator":
      return negate ? CREATOR_FALSE[value] : CREATOR_TRUE[value];
  }
}

function fmtYear(y: number): string {
  return y < 0 ? `${-y} BCE` : String(y);
}

export function yearClueText(op: "before" | "after", year: number): string {
  return op === "before" ? `It came before the year ${fmtYear(year)}` : `It came after the year ${fmtYear(year)}`;
}

/* ---------------- generator ---------------- */

const YEAR_MARKS = [-2000, -500, 500, 1000, 1400, 1600, 1700, 1800, 1850, 1900, 1925, 1950, 1975, 1990, 2000, 2010];

/**
 * Pick a minimal, varied riddle set (3–5 plaques) that isolates the
 * answer. Deterministic per seed. Throws if the candidate set cannot be
 * isolated without a single giveaway riddle.
 */
export function generateAstrolabeClues(
  answerId: string,
  candidates: readonly string[],
  byId: ReadonlyMap<string, Entity>,
  seed: number
): AstrolabeClue[] {
  const answer = byId.get(answerId)!;
  const ents = candidates.map((id) => byId.get(id)!);
  const others = ents.filter((e) => e.entity_id !== answerId);
  const pool: AstrolabeClue[] = [];
  const attrs: AstrolabeAttribute[] = ["region", "era", "domain", "creator"];
  for (const attribute of attrs) {
    const value = attributeOf(answer, attribute);
    pool.push({ type: "ATTR", attribute, value, negate: false, text: attributeClueText(attribute, value, false) });
    const otherValues = new Set(others.map((e) => attributeOf(e, attribute)).filter((v) => v !== value));
    for (const v of otherValues) pool.push({ type: "ATTR", attribute, value: v, negate: true, text: attributeClueText(attribute, v, true) });
  }
  if (answer.era_year !== null && ents.every((e) => e.era_year !== null)) {
    const years = new Set(ents.map((e) => e.era_year!));
    for (const y of YEAR_MARKS) {
      if (years.has(y)) continue;
      const op = answer.era_year < y ? "before" : "after";
      pool.push({ type: "YEAR", op, year: y, text: yearClueText(op, y) });
    }
  }
  const eliminates = (c: AstrolabeClue) => new Set(others.filter((e) => !astroClueHolds(e, c)).map((e) => e.entity_id));
  const usable = pool.filter((c) => {
    const el = eliminates(c);
    return el.size > 0 && el.size < others.length; // useful, and never a giveaway
  });
  const rng = mulberry32(seed);
  let best: AstrolabeClue[] | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const order = shuffleWith(usable, rng);
    const chosen: AstrolabeClue[] = [];
    const covered = new Set<string>();
    for (const c of order) {
      if (covered.size === others.length) break;
      const el = eliminates(c);
      const fresh = [...el].filter((id) => !covered.has(id));
      if (fresh.length === 0) continue;
      // Avoid two riddles about the same attribute value pair (repetitive plaques).
      if (chosen.some((x) => x.type === "ATTR" && c.type === "ATTR" && x.attribute === c.attribute && x.negate === false && c.negate === false)) continue;
      chosen.push(c);
      el.forEach((id) => covered.add(id));
    }
    if (covered.size !== others.length) continue;
    for (let i = chosen.length - 1; i >= 0; i--) {
      const without = chosen.filter((_, k) => k !== i);
      const cov = new Set<string>();
      without.forEach((c) => eliminates(c).forEach((id) => cov.add(id)));
      if (cov.size === others.length && without.length >= 3) chosen.splice(i, 1);
    }
    if (chosen.length < 3 || chosen.length > 5) continue;
    if (!best || Math.abs(chosen.length - 4) < Math.abs(best.length - 4)) best = chosen;
    if (chosen.length === 4) break;
  }
  if (!best) throw new Error(`Could not generate astrolabe riddles for ${answer.canonical_title}`);
  return best;
}

/** Problems with an astrolabe spec (empty when sound). */
export function verifyAstrolabe(spec: AstrolabeChamberSpec, byId: ReadonlyMap<string, Entity>): string[] {
  const problems: string[] = [];
  if (!spec.candidates.includes(spec.answer)) problems.push("Answer is not on the dial");
  if (new Set(spec.candidates).size !== spec.candidates.length) problems.push("Duplicate candidates");
  for (const id of spec.candidates) if (!byId.has(id)) problems.push(`Unknown candidate ${id}`);
  if (problems.length) return problems;
  const answer = byId.get(spec.answer)!;
  spec.clues.forEach((c, i) => {
    if (!astroClueHolds(answer, c)) problems.push(`Riddle ${i + 1} is false for the answer`);
    const left = remainingCandidates(spec.candidates, byId, [c]);
    if (left.length === spec.candidates.length) problems.push(`Riddle ${i + 1} rules nothing out`);
    if (left.length < 2) problems.push(`Riddle ${i + 1} alone gives the answer away`);
  });
  const remaining = remainingCandidates(spec.candidates, byId, spec.clues);
  if (!(remaining.length === 1 && remaining[0] === spec.answer)) {
    problems.push(`All riddles together leave ${remaining.length} candidates, not exactly the answer`);
  }
  if (spec.clues.length < 3) problems.push("Fewer than 3 riddles");
  return problems;
}
