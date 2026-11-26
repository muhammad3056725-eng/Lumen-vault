/**
 * LUMEN VAULT — shared schema definitions (Blueprint §5 entity schema,
 * §2 chamber types, §3/S3 Wonder Artifact Cards).
 *
 * Entity facets drive every lock type:
 *  - Venn rings test membership in a named facet set (`facets`).
 *  - Chrono gears order entities by `era_year` under relational clues.
 *  - Astrolabe attributes are region / era / domain / creator_type.
 *  - Resonance Forge constraints test sensory tags, domain, initials.
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
  /** Anchor year: release / invention / founding / occurrence. Negative = BCE. */
  era_year: number | null;
  region_id: RegionId;
  primary_domain: string;
  secondary_domain: string | null;
  creator_type: CreatorType;
  /** 0..100 — drives Creative Spark rarity (lower = rarer answer). */
  notability_score: number;
  sensory_tags: string[];
  /** Named boolean facets tested by Venn rings, e.g. "DECADE_1990S". */
  facets: string[];
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
/* Chambers (Blueprint §2)                                             */
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
  /** Entity ids of the draggable vellum tiles. */
  tiles: string[];
  /** 3-ring chambers only: typed answer must satisfy ALL rings (H3: ≥15 valid in dictionary). */
  brainstormSocket: boolean;
}

export type ChronoClue =
  | { type: "GAP_YEARS"; a: number; b: number; years: number } // gear b happened `years` after gear a
  | { type: "SAME_REGION"; a: number; b: number }
  | { type: "BEFORE_YEAR_COUNT"; year: number; count: number } // exactly `count` gears before `year`
  | { type: "IMMEDIATELY_BEFORE"; a: number; b: number };

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

export interface AstrolabeFilter {
  attribute: AstrolabeAttribute;
  /** Keep candidates whose attribute equals `keep` (true) or differs (false). */
  keep: boolean;
  value: string;
  label: string;
}

export interface AstrolabeChamberSpec {
  kind: "astrolabe";
  id: string;
  title: string;
  intro: string;
  /** Entity id of the hidden artifact. */
  answer: string;
  /** Candidate entity ids shown as dial sectors (includes the answer). */
  candidates: string[];
  filters: AstrolabeFilter[];
}

export type ChamberSpec =
  | VennChamberSpec
  | ChronoChamberSpec
  | ForgeChamberSpec
  | AstrolabeChamberSpec;

/* ------------------------------------------------------------------ */
/* Wonder Artifact Cards (Blueprint §2 / S3)                           */
/* ------------------------------------------------------------------ */

export interface ArtifactCard {
  id: string;
  chamberId: string;
  name: string;
  /** Short vector-motif key rendered by the web app (no raster art). */
  motif: string;
  /** Exactly 2 sentences of curated lore (S3). */
  lore: string;
}

export interface WingSpec {
  id: string;
  title: string;
  theme: string;
  /** Ordered chamber ids; the constellation branches by listing nodes. */
  chambers: string[];
}

export interface DailyVault {
  date: string; // YYYY-MM-DD (UTC)
  number: number; // vault number, days since launch epoch
  chambers: string[]; // 5 chamber ids, pacing curve M1
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
