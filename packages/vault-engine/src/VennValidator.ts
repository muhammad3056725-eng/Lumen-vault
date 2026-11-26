/**
 * VennValidator (Chamber Type A).
 * A tile's region is the bitmask of rings whose facet the entity
 * holds; bit i corresponds to rings[i]. Placement is correct iff the
 * chosen region equals the entity's true region. Any number of tiles
 * may share a region — every region socket holds as many as belong.
 */
import type { Entity, VennChamberSpec, VennRing } from "@lumen-vault/shared-types";

export function entityHasFacet(entity: Entity, facet: string): boolean {
  return entity.facets.includes(facet);
}

export function regionOf(entity: Entity, rings: readonly VennRing[]): number {
  let mask = 0;
  rings.forEach((ring, i) => {
    if (entityHasFacet(entity, ring.facet)) mask |= 1 << i;
  });
  return mask;
}

/** Human label for a region bitmask, e.g. "Released in the 1990s + Won an Oscar". */
export function regionLabel(mask: number, rings: readonly VennRing[]): string {
  if (mask === 0) return "outside every ring";
  const names = rings.filter((_, i) => mask & (1 << i)).map((r) => r.label);
  const only = mask !== (1 << rings.length) - 1 && rings.length > 1 ? " only" : "";
  return names.join(" + ") + only;
}

export interface VennValidation {
  perTile: Record<string, boolean>;
  wrongCount: number;
  allCorrect: boolean;
}

export function validatePlacements(
  spec: VennChamberSpec,
  entities: ReadonlyMap<string, Entity>,
  placements: ReadonlyMap<string, number>
): VennValidation {
  const perTile: Record<string, boolean> = {};
  let wrongCount = 0;
  for (const tileId of spec.tiles) {
    const entity = entities.get(tileId);
    if (!entity) throw new Error(`Unknown tile entity ${tileId}`);
    const placed = placements.get(tileId);
    const ok = placed !== undefined && placed === regionOf(entity, spec.rings);
    perTile[tileId] = ok;
    if (!ok) wrongCount++;
  }
  return { perTile, wrongCount, allCorrect: wrongCount === 0 };
}

/** Does this entity satisfy ALL rings (the brainstorm socket test)? */
export function satisfiesAllRings(entity: Entity, rings: readonly VennRing[]): boolean {
  return regionOf(entity, rings) === (1 << rings.length) - 1;
}
