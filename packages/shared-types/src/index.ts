/**
 * LUMEN VAULT — shared schema definitions.
 *
 * Entity facets drive every lock type:
 *  - Venn rings test membership in a named facet (`facets`).
 *  - Chrono gears are ordered by `era_year`, deduced from relational clues.
 *  - Astrolabe riddles test region / era / domain / creator type / year.
 *  - Resonance Forge runes test sensory tags, domains, facets and initials.
 */

export type RegionId =
  | "REG_EUROPE"
  | "REG_NORTH_AMERICA"
  | "REG_SOUTH_AMERICA"
  | "REG_ASIA"
  | "REG_AFRICA"
  | "REG_OCEANIA"
  | "REG_MIDDLE_EAST"
  | "REG_GLOBAL";

export type CreatorType =
  | "SOLO"
  | "DUO"
  | "TEAM"
  | "TEAM_GOVERNMENT_AGENCY"
  | "NATURE"
  | "TRADITIONAL";

export interface Entity {
  entity_id: string;
  canonical_title: string;
  aliases: string[];
  /** Anchor year: release / invention / founding / occurrence. Negative = BCE. Null = timeless. */
  era_year: number | null;
  region_id: RegionId;
  primary_domain: string;
  secondary_domain: string | null;
  creator_type: CreatorType;
  /** 0..100 — drives Creative Spark rarity (lower = rarer answer). */
  notability_score: number;
  sensory_tags: string[];
  /** Named boolean facets tested by Venn rings and forge runes, e.g. "DECADE_1990S". */
  facets: string[];
  /** Present only on entities that came from the Wikidata pipeline. */
  wikidata_id?: string;
}

/** Era buckets used by the Astrolabe's Era attribute. */
export type EraBucket =
  | "ANCIENT" // < 500
  | "MEDIEVAL" // 500–1499
  | "EARLY_MODERN" // 1500–1799
  | "NINETEENTH" // 1800–1899
  | "TWENTIETH" // 1900–1999
  | "TWENTY_FIRST"; // 2000+

export function eraBucket(year: number | null): EraBucket | null {
  if (year === null) return null;
  if (year < 500) return "ANCIENT";
  if (year < 1500) return "MEDIEVAL";
  if (year < 1800) return "EARLY_MODERN";
  if (year < 1900) return "NINETEENTH";
  if (year < 2000) return "TWENTIETH";
  return "TWENTY_FIRST";
}

/* ------------------------------------------------------------------ */
/* Chambers                                                            */
/* ------------------------------------------------------------------ */

export type ChamberKind = "venn" | "chrono" | "forge" | "astrolabe";

export interface VennRing {
  facet: string;
  label: string;
}

export interface VennChamberSpec {
  kind: "venn";
  id: string;
  title: string;
  intro: string;
  rings: VennRing[]; // 2 or 3
  /** Entity ids of the draggable vellum tiles. Several tiles may share a region. */
  tiles: string[];
  /** 3-ring chambers only: a typed answer must satisfy ALL rings (≥15 valid in the dictionary). */
  brainstormSocket: boolean;
}

/**
 * Relational chrono clues. `a`, `b`, `c` are entity ids of gears; every
 * clue is checked against the gears' true chronological positions.
 */
export type ChronoClue =
  | { type: "BEFORE"; a: string; b: string }
  | { type: "IMMEDIATELY_BEFORE"; a: string; b: string }
  | { type: "GAP_YEARS"; a: string; b: string; years: number }
  | { type: "FIRST"; a: string }
  | { type: "LAST"; a: string }
  | { type: "NOT_ADJACENT"; a: string; b: string }
  | { type: "BETWEEN"; a: string; b: string; c: string };

export interface ChronoChamberSpec {
  kind: "chrono";
  id: string;
  title: string;
  intro: string;
  /** Entity ids, one per gear (4 or 5). Display order is shuffled by the client. */
  gears: string[];
  clues: ChronoClue[];
}

export type ForgeConstraint =
  | { type: "SENSORY"; tag: string; label: string }
  | { type: "DOMAIN"; domain: string; label: string }
  | { type: "FACET"; facet: string; label: string }
  | { type: "INITIALS"; letters: string[]; label: string };

export interface ForgeChamberSpec {
  kind: "forge";
  id: string;
  title: string;
  intro: string;
  constraints: ForgeConstraint[]; // exactly 3
  answersNeeded: 3;
}

export type AstrolabeAttribute = "region" | "era" | "domain" | "creator";

/** A riddle plaque: a true statement about the hidden artifact. */
export type AstrolabeClue =
  | { type: "ATTR"; attribute: AstrolabeAttribute; value: string; negate: boolean; text: string }
  | { type: "YEAR"; op: "before" | "after"; year: number; text: string };

export interface AstrolabeChamberSpec {
  kind: "astrolabe";
  id: string;
  title: string;
  intro: string;
  /** Entity id of the hidden artifact. */
  answer: string;
  /** Candidate entity ids shown on the dial (includes the answer). */
  candidates: string[];
  clues: AstrolabeClue[];
}

export type ChamberSpec =
  | VennChamberSpec
  | ChronoChamberSpec
  | ForgeChamberSpec
  | AstrolabeChamberSpec;

/* ------------------------------------------------------------------ */
/* Wonder Artifact Cards                                               */
/* ------------------------------------------------------------------ */

export interface ArtifactCard {
  id: string;
  chamberId: string;
  name: string;
  /** "glyph:frame" — a vector motif rendered by the web app (no raster art). Unique per card. */
  motif: string;
  /** Exactly 2 sentences of curated lore. */
  lore: string;
}

export interface WingSpec {
  id: string;
  title: string;
  theme: string;
  /** Ordered chamber ids; every chamber belongs to exactly one wing. */
  chambers: string[];
}

export interface DailyVault {
  date: string; // YYYY-MM-DD (UTC)
  number: number; // vault number, days since launch epoch + 1
  chambers: string[]; // 5 chamber ids on the pacing curve
}

export interface DataManifest {
  version: string;
  generatedAt: string;
  entityCount: number;
  chamberCount: number;
  wingCount: number;
  artifactCount: number;
  files: Record<string, string>;
}
