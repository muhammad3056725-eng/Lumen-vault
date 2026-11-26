/**
 * Curated seed loader. Entities live in tools/seed/entities/*.txt, one
 * per line:
 *   id|title|year|region|domain[/secondary]|creator|notability|facets|sensory|aliases
 * Pipeline-ingested entities (pipeline/tag_facets.py --merge) live in
 * tools/seed/ingested.json and are appended, never overwritten.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CreatorType, Entity, RegionId } from "@lumen-vault/shared-types";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const REGION: Record<string, RegionId> = {
  EU: "REG_EUROPE",
  NA: "REG_NORTH_AMERICA",
  SA: "REG_SOUTH_AMERICA",
  AS: "REG_ASIA",
  AF: "REG_AFRICA",
  OC: "REG_OCEANIA",
  ME: "REG_MIDDLE_EAST",
  GL: "REG_GLOBAL",
};
export const DOMAIN: Record<string, string> = {
  FILM: "DOM_FILM",
  LIT: "DOM_LITERATURE",
  MUS: "DOM_MUSIC",
  ART: "DOM_ART",
  INV: "DOM_INVENTION",
  SCI: "DOM_SCIENCE",
  SPACE: "DOM_SPACE_EXPLORATION",
  ENG: "DOM_ENGINEERING",
  NAT: "DOM_NATURE",
  ANI: "DOM_ANIMALS",
  MYTH: "DOM_MYTHOLOGY",
  GAME: "DOM_VIDEO_GAMES",
  FOOD: "DOM_FOOD",
  SPORT: "DOM_SPORT",
};
const CREATOR: Record<string, CreatorType> = {
  SOLO: "SOLO",
  DUO: "DUO",
  TEAM: "TEAM",
  AGENCY: "TEAM_GOVERNMENT_AGENCY",
  NATURE: "NATURE",
  TRAD: "TRADITIONAL",
};
/** Short curated facet codes → stored facet names. */
const FACET: Record<string, string> = {
  OSCAR: "WON_OSCAR",
  SCIFI: "SETTING_SPACE_SCIFI",
  ANIM: "ANIMATED",
  FANT: "FANTASY_WORK",
  INV: "INVENTED",
  DISC: "DISCOVERED",
  NOBEL: "WON_NOBEL",
  STRUCT: "MAN_MADE_STRUCTURE",
  SCULPT: "SCULPTURE",
  PAINT: "PAINTING",
  NOVEL: "NOVEL",
  PLAY: "PLAY",
  POEM: "POEM",
  CLASSICAL: "CLASSICAL_WORK",
  SONG: "SONG",
  ALBUM: "ALBUM",
  MOUNTAIN: "MOUNTAIN",
  VOLCANO: "VOLCANO",
  WATERFALL: "WATERFALL",
  RIVER: "RIVER",
  LAKE: "LAKE",
  DESERT: "DESERT",
  ISLAND: "ISLAND",
  CANYON: "CANYON",
  REEF: "REEF",
  GEYSER: "GEYSER",
  GLACIER: "GLACIER",
  BRIDGE: "BRIDGE",
  MAMMAL: "MAMMAL",
  BIRD: "BIRD",
  FISH: "FISH",
  REPTILE: "REPTILE",
  AMPHIBIAN: "AMPHIBIAN",
  INSECT: "INSECT",
  MOLLUSC: "MOLLUSC",
  DEITY: "DEITY",
  CREATURE: "CREATURE",
  HERO: "HERO",
};
export const SENSORY = new Set(["COLD", "FIRE", "AQUATIC", "NOCTURNAL", "ARID", "STORM", "GLOWING", "SWEET", "SPICY", "VERDANT", "GOLDEN", "FLIGHT"]);

/** Mechanical facets derived from fields (mirrored by pipeline/tag_facets.py). */
export function deriveFacets(e: Omit<Entity, "facets"> & { facets?: string[] }): string[] {
  const facets = new Set(e.facets ?? []);
  const y = e.era_year;
  if (y !== null && y !== undefined) {
    if (y < 500) facets.add("ANCIENT_WORLD");
    if (y < 1900) facets.add("PRE_1900");
    if (y < 1950) facets.add("PRE_1950");
    if (y >= 1800 && y < 1900) facets.add("CENTURY_19TH");
    if (y >= 1900 && y < 2000) facets.add("CENTURY_20TH");
    if (y >= 2000 && y < 2100) facets.add("CENTURY_21ST");
    if (y >= 0 && y < 2100) facets.add(`DECADE_${Math.floor(y / 10) * 10}S`);
  } else {
    facets.add("TIMELESS");
  }
  facets.add(e.region_id.replace("REG_", "REGION_"));
  facets.add(`CREATOR_${e.creator_type}`);
  facets.add(e.primary_domain.replace("DOM_", "DOMAIN_"));
  if (e.secondary_domain) facets.add(e.secondary_domain.replace("DOM_", "DOMAIN_"));
  for (const t of e.sensory_tags) facets.add(`SENSE_${t}`);
  return [...facets].sort();
}

function parseLine(line: string, file: string, n: number): Entity {
  const parts = line.split("|");
  if (parts.length !== 10) throw new Error(`${file}:${n}: expected 10 fields, got ${parts.length}`);
  const [id, title, year, region, domains, creator, notability, facets, sensory, aliases] = parts.map((p) => p.trim());
  const [dom1, dom2] = domains.split("/");
  const fail = (msg: string) => {
    throw new Error(`${file}:${n}: ${msg}`);
  };
  if (!/^\d{4}$/.test(id)) fail(`bad id ${id}`);
  if (!REGION[region]) fail(`bad region ${region}`);
  if (!DOMAIN[dom1] || (dom2 && !DOMAIN[dom2])) fail(`bad domain ${domains}`);
  if (!CREATOR[creator]) fail(`bad creator ${creator}`);
  const facetList = facets ? facets.split(",").map((f) => FACET[f] ?? fail(`bad facet ${f}`)) : [];
  const tagList = sensory ? sensory.split(",") : [];
  for (const t of tagList) if (!SENSORY.has(t)) fail(`bad sensory tag ${t}`);
  const score = Number(notability);
  if (!(score >= 50 && score <= 100)) fail(`bad notability ${notability}`);
  const base = {
    entity_id: `E-${id}`,
    canonical_title: title,
    aliases: aliases ? aliases.split(";").map((a) => a.trim()).filter(Boolean) : [],
    era_year: year === "" ? null : Number(year),
    region_id: REGION[region],
    primary_domain: DOMAIN[dom1],
    secondary_domain: dom2 ? DOMAIN[dom2] : null,
    creator_type: CREATOR[creator],
    notability_score: score,
    sensory_tags: tagList,
    facets: facetList as string[],
  };
  if (base.era_year !== null && !Number.isInteger(base.era_year)) fail(`bad year ${year}`);
  return { ...base, facets: deriveFacets(base) };
}

export function loadEntities(): Entity[] {
  const dir = join(ROOT, "tools", "seed", "entities");
  const out: Entity[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const lines = readFileSync(join(dir, file), "utf8").split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      out.push(parseLine(line, file, i + 1));
    });
  }
  const ingestedPath = join(ROOT, "tools", "seed", "ingested.json");
  if (existsSync(ingestedPath)) {
    const ingested = JSON.parse(readFileSync(ingestedPath, "utf8")) as Entity[];
    for (const e of ingested) out.push({ ...e, facets: deriveFacets(e) });
  }
  const ids = new Set<string>();
  for (const e of out) {
    if (ids.has(e.entity_id)) throw new Error(`Duplicate entity id ${e.entity_id}`);
    ids.add(e.entity_id);
  }
  return out.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
}

/** Human labels for facets used by Venn rings and forge runes. */
export const FACET_LABEL: Record<string, string> = {
  WON_OSCAR: "Won a competitive Oscar",
  SETTING_SPACE_SCIFI: "Space or science fiction",
  ANIMATED: "Animated",
  FANTASY_WORK: "A work of fantasy",
  INVENTED: "An invention",
  DISCOVERED: "A discovery",
  WON_NOBEL: "Honoured by a Nobel Prize",
  MAN_MADE_STRUCTURE: "A built structure",
  SCULPTURE: "A sculpture",
  PAINTING: "A painting",
  NOVEL: "A novel",
  PLAY: "A stage play",
  POEM: "A poem",
  CLASSICAL_WORK: "A classical work",
  SONG: "A song",
  ALBUM: "An album",
  MOUNTAIN: "A mountain",
  VOLCANO: "A volcano",
  WATERFALL: "A waterfall",
  RIVER: "A river",
  LAKE: "A lake",
  DESERT: "A desert",
  ISLAND: "An island",
  BRIDGE: "A bridge",
  MAMMAL: "A mammal",
  BIRD: "A bird",
  FISH: "A fish",
  REPTILE: "A reptile",
  DEITY: "A god or goddess",
  CREATURE: "A mythical creature",
  HERO: "A legendary hero",
  ANCIENT_WORLD: "From the ancient world (before 500)",
  PRE_1900: "Made before 1900",
  PRE_1950: "Made before 1950",
  CENTURY_19TH: "From the 19th century",
  CENTURY_20TH: "From the 20th century",
  CENTURY_21ST: "From the 21st century",
  TIMELESS: "Timeless (no date)",
  REGION_EUROPE: "From Europe",
  REGION_NORTH_AMERICA: "From North America",
  REGION_SOUTH_AMERICA: "From South America",
  REGION_ASIA: "From Asia",
  REGION_AFRICA: "From Africa",
  REGION_OCEANIA: "From Oceania",
  REGION_MIDDLE_EAST: "From the Middle East",
  CREATOR_SOLO: "Made by one person",
  CREATOR_DUO: "Made by a pair",
  CREATOR_TEAM: "Made by a team",
  CREATOR_TEAM_GOVERNMENT_AGENCY: "Built by a space agency",
  CREATOR_TRADITIONAL: "From tradition (no single maker)",
  SENSE_COLD: "Tied to cold or ice",
  SENSE_FIRE: "Tied to fire or heat",
  SENSE_AQUATIC: "Tied to water",
  SENSE_NOCTURNAL: "Tied to night",
  SENSE_ARID: "Tied to deserts or drought",
  SENSE_STORM: "Tied to storms",
  SENSE_GLOWING: "Gives off light",
  SENSE_SWEET: "Sweet",
  SENSE_SPICY: "Spicy-hot",
  SENSE_VERDANT: "Lush and green",
  SENSE_GOLDEN: "Golden",
  SENSE_FLIGHT: "Tied to flight",
};

export function facetLabel(facet: string): string {
  if (FACET_LABEL[facet]) return FACET_LABEL[facet];
  const dec = facet.match(/^DECADE_(\d+)S$/);
  if (dec) return `From the ${dec[1]}s`;
  const dom = facet.match(/^DOMAIN_(.+)$/);
  if (dom) return DOMAIN_RUNE[`DOM_${dom[1]}`] ?? dom[1];
  throw new Error(`No label for facet ${facet}`);
}

export const DOMAIN_RUNE: Record<string, string> = {
  DOM_FILM: "A film",
  DOM_LITERATURE: "A work of literature",
  DOM_MUSIC: "A work of music",
  DOM_ART: "A work of art",
  DOM_INVENTION: "An invention",
  DOM_SCIENCE: "A scientific discovery",
  DOM_SPACE_EXPLORATION: "A space mission",
  DOM_ENGINEERING: "A work of architecture or engineering",
  DOM_NATURE: "A wonder of nature",
  DOM_ANIMALS: "An animal",
  DOM_MYTHOLOGY: "A figure of myth",
  DOM_VIDEO_GAMES: "A video game",
  DOM_FOOD: "A food or drink",
  DOM_SPORT: "A sporting event",
};

export const SENSORY_RUNE: Record<string, string> = {
  COLD: "Tied to cold or ice",
  FIRE: "Tied to fire or heat",
  AQUATIC: "Tied to water",
  NOCTURNAL: "Tied to night",
  ARID: "Tied to deserts or drought",
  STORM: "Tied to storms or thunder",
  GLOWING: "Gives off its own light",
  SWEET: "Sweet",
  SPICY: "Spicy-hot",
  VERDANT: "Lush and green",
  GOLDEN: "Golden",
  FLIGHT: "Tied to flight or the sky",
};
