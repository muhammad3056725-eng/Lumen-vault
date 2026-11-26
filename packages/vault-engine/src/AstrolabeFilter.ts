/**
 * AstrolabeFilter (Blueprint §2 Chamber Type D).
 * Candidates carry four attributes — Origin Region, Era, Discipline
 * (primary domain), Signature Trait (creator type). Flipping a filter
 * switch greys out every sector the filter excludes.
 */
import {
  eraBucket,
  type AstrolabeAttribute,
  type AstrolabeChamberSpec,
  type AstrolabeFilter,
  type Entity,
} from "@lumen-vault/shared-types";

export function attributeOf(entity: Entity, attribute: AstrolabeAttribute): string | null {
  switch (attribute) {
    case "region":
      return entity.region_id;
    case "era":
      return eraBucket(entity.era_year);
    case "domain":
      return entity.primary_domain;
    case "creator":
      return entity.creator_type;
  }
}

export function passesFilter(entity: Entity, filter: AstrolabeFilter): boolean {
  const value = attributeOf(entity, filter.attribute);
  const equal = value !== null && value === filter.value;
  return filter.keep ? equal : !equal;
}

/** Candidate ids remaining after the active filters are applied. */
export function applyFilters(
  spec: AstrolabeChamberSpec,
  entities: ReadonlyMap<string, Entity>,
  active: ReadonlySet<number>
): string[] {
  return spec.candidates.filter((id) => {
    const entity = entities.get(id);
    if (!entity) throw new Error(`Unknown candidate entity ${id}`);
    return spec.filters.every((f, i) => !active.has(i) || passesFilter(entity, f));
  });
}

/** The full 4-attribute signature of an entity (for uniqueness proofs). */
export function attributeSignature(entity: Entity): string {
  return (["region", "era", "domain", "creator"] as AstrolabeAttribute[])
    .map((a) => attributeOf(entity, a) ?? "∅")
    .join("|");
}
