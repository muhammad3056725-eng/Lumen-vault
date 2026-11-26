/**
 * BrainstormEvaluator (Blueprint §2 Chamber Type C + §4 H6/M3).
 * Resonance Forge answers are free text: normalized, profanity
 * scrubbed, matched forgivingly to the dictionary, then tested
 * against every rune constraint. Creative Spark rarity derives from
 * the entity's notability (rarer answers spark brighter).
 */
import type { Entity, ForgeChamberSpec, ForgeConstraint } from "@lumen-vault/shared-types";
import { matchEntity, type MatchResult } from "./normalize.js";

export function satisfiesConstraint(entity: Entity, c: ForgeConstraint): boolean {
  switch (c.type) {
    case "SENSORY":
      return entity.sensory_tags.includes(c.tag);
    case "DOMAIN":
      return entity.primary_domain === c.domain || entity.secondary_domain === c.domain;
    case "INITIALS": {
      const first = entity.canonical_title.replace(/^(The|A|An)\s+/i, "").charAt(0).toUpperCase();
      return c.letters.includes(first);
    }
  }
}

export function satisfiesAllConstraints(
  entity: Entity,
  constraints: readonly ForgeConstraint[]
): boolean {
  return constraints.every((c) => satisfiesConstraint(entity, c));
}

/** Every dictionary entity that could fill the prism (the valid pool). */
export function forgePool(
  spec: ForgeChamberSpec,
  entities: readonly Entity[]
): Entity[] {
  return entities.filter((e) => satisfiesAllConstraints(e, spec.constraints));
}

export interface ForgeAnswerResult {
  accepted: boolean;
  reason: string;
  match: MatchResult | null;
  entity: Entity | null;
  /** True when this entity was already offered in this chamber. */
  duplicate: boolean;
}

export function evaluateForgeAnswer(
  rawInput: string,
  spec: ForgeChamberSpec,
  entities: readonly Entity[],
  alreadyUsed: ReadonlySet<string>
): ForgeAnswerResult {
  const match = matchEntity(rawInput, entities);
  if (!match) {
    return {
      accepted: false,
      reason: "The prism doesn't recognise that name — check the spelling, or dream a little wider.",
      match: null,
      entity: null,
      duplicate: false,
    };
  }
  const entity = entities.find((e) => e.entity_id === match.entityId) ?? null;
  if (!entity) {
    return { accepted: false, reason: "That light slipped away.", match, entity: null, duplicate: false };
  }
  if (alreadyUsed.has(entity.entity_id)) {
    return {
      accepted: false,
      reason: `${entity.canonical_title} already glows in the prism — offer something new.`,
      match,
      entity,
      duplicate: true,
    };
  }
  const failed = spec.constraints.filter((c) => !satisfiesConstraint(entity, c));
  if (failed.length > 0) {
    return {
      accepted: false,
      reason: `${entity.canonical_title} is a fine answer, but it breaks a rune: ${failed[0].label}.`,
      match,
      entity,
      duplicate: false,
    };
  }
  return { accepted: true, reason: `${entity.canonical_title} pours its light into the prism.`, match, entity, duplicate: false };
}

/** Rarity: answers few players would think of (low notability) are "rare". */
export const RARE_NOTABILITY_THRESHOLD = 85;

export function isRare(entity: Entity): boolean {
  return entity.notability_score < RARE_NOTABILITY_THRESHOLD;
}
