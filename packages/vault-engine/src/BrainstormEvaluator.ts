/**
 * BrainstormEvaluator (Chamber Type C — Resonance Forge).
 * Answers are free text: normalized and matched forgivingly to the
 * dictionary (same-title entities are disambiguated by the runes),
 * then tested against every rune. A name the dictionary does not know
 * is never counted as a mistake — only a known answer that breaks a
 * rune is.
 */
import type { Entity, ForgeChamberSpec, ForgeConstraint } from "@lumen-vault/shared-types";
import { matchEntity, type MatchResult } from "./normalize.js";

export const MIN_FORGE_POOL = 8;

export function initialOf(title: string): string {
  const stripped = title.replace(/^(The|A|An)\s+/i, "");
  const folded = stripped.normalize("NFKD").replace(/\p{M}/gu, "");
  const m = folded.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : "";
}

export function satisfiesConstraint(entity: Entity, c: ForgeConstraint): boolean {
  switch (c.type) {
    case "SENSORY":
      return entity.sensory_tags.includes(c.tag);
    case "DOMAIN":
      return entity.primary_domain === c.domain || entity.secondary_domain === c.domain;
    case "FACET":
      return entity.facets.includes(c.facet);
    case "INITIALS":
      return c.letters.includes(initialOf(entity.canonical_title));
  }
}

export function satisfiesAllConstraints(entity: Entity, constraints: readonly ForgeConstraint[]): boolean {
  return constraints.every((c) => satisfiesConstraint(entity, c));
}

/** Every dictionary entity that could fill the prism (the valid pool). */
export function forgePool(spec: ForgeChamberSpec, entities: readonly Entity[]): Entity[] {
  return entities.filter((e) => satisfiesAllConstraints(e, spec.constraints));
}

export type ForgeOutcome = "accepted" | "unknown" | "duplicate" | "rune";

export interface ForgeAnswerResult {
  accepted: boolean;
  outcome: ForgeOutcome;
  reason: string;
  match: MatchResult | null;
  entity: Entity | null;
  /** True when this entity was already offered in this chamber. */
  duplicate: boolean;
  /** Counts against Logic Precision (only known answers that break a rune). */
  countsAsWrong: boolean;
}

export function evaluateForgeAnswer(
  rawInput: string,
  spec: ForgeChamberSpec,
  entities: readonly Entity[],
  alreadyUsed: ReadonlySet<string>,
  byId?: ReadonlyMap<string, Entity>
): ForgeAnswerResult {
  const lookup = byId ?? new Map(entities.map((e) => [e.entity_id, e]));
  const match = matchEntity(rawInput, entities, (id) => {
    const e = lookup.get(id);
    return !!e && !alreadyUsed.has(id) && satisfiesAllConstraints(e, spec.constraints);
  });
  if (!match) {
    return {
      accepted: false,
      outcome: "unknown",
      reason: "The prism doesn't know that name yet — no harm done. Try another spelling, or another idea.",
      match: null,
      entity: null,
      duplicate: false,
      countsAsWrong: false,
    };
  }
  const entity = lookup.get(match.entityId) ?? null;
  if (!entity) {
    return { accepted: false, outcome: "unknown", reason: "That light slipped away.", match, entity: null, duplicate: false, countsAsWrong: false };
  }
  if (alreadyUsed.has(entity.entity_id)) {
    return {
      accepted: false,
      outcome: "duplicate",
      reason: `${entity.canonical_title} already glows in the prism — offer something new.`,
      match,
      entity,
      duplicate: true,
      countsAsWrong: false,
    };
  }
  const failed = spec.constraints.filter((c) => !satisfiesConstraint(entity, c));
  if (failed.length > 0) {
    return {
      accepted: false,
      outcome: "rune",
      reason: `${entity.canonical_title} is a fine answer, but it breaks a rune: ${failed[0].label}.`,
      match,
      entity,
      duplicate: false,
      countsAsWrong: true,
    };
  }
  const heard = match.via === "canonical" || match.via === "alias" ? "" : ` (heard as “${entity.canonical_title}”)`;
  return {
    accepted: true,
    outcome: "accepted",
    reason: `${entity.canonical_title} pours its light into the prism${heard}.`,
    match,
    entity,
    duplicate: false,
    countsAsWrong: false,
  };
}

/** Rarity: answers few players would think of (lower notability) are "rare". */
export const RARE_NOTABILITY_THRESHOLD = 85;

export function isRare(entity: Entity): boolean {
  return entity.notability_score < RARE_NOTABILITY_THRESHOLD;
}

/**
 * Pick the smallest set of initial letters (most common first) that
 * keeps at least `minPool` entities in the pool — used by the builder.
 */
export function chooseInitialLetters(pool: readonly Entity[], minPool: number): string[] {
  const freq = new Map<string, number>();
  for (const e of pool) {
    const l = initialOf(e.canonical_title);
    freq.set(l, (freq.get(l) ?? 0) + 1);
  }
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const letters: string[] = [];
  let covered = 0;
  for (const [l, n] of ranked) {
    letters.push(l);
    covered += n;
    if (covered >= minPool && letters.length >= 3) break;
  }
  return letters.sort();
}
