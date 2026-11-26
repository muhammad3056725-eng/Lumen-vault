#!/usr/bin/env node
/**
 * LUMEN VAULT data builder (Blueprint §5 layout, H3 proof gate).
 * Reads the curated seed (tools/seed/*.json), derives facet tags from
 * entity fields, assembles public/data/v1/*, and verifies EVERY
 * chamber with the solvability rules mirrored from
 * @packages/vault-engine (the engine's own test suite re-verifies the
 * shipped JSON independently). Exits non-zero if any proof fails.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seed = (name) => JSON.parse(readFileSync(join(root, "tools/seed", name), "utf8"));
const out = (rel, data) => {
  const path = join(root, "public/data/v1", rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data, null, 1));
  return path;
};
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/* ---------------- facet derivation ---------------- */
function deriveFacets(e) {
  const facets = new Set(e.facets);
  const y = e.era_year;
  if (y !== null && y !== undefined) {
    if (y < 500) facets.add("ANCIENT_WORLD");
    if (y < 1900) facets.add("PRE_1900");
    if (y < 1950) facets.add("PRE_1950");
    if (y >= 1800 && y < 1900) facets.add("CENTURY_19TH");
    if (y >= 1900 && y < 2000) facets.add("CENTURY_20TH");
    if (y >= 2000 && y < 2100) facets.add("CENTURY_21ST");
    if (y >= 0 && y < 2030) facets.add(`DECADE_${Math.floor(y / 10) * 10}S`);
  }
  facets.add(e.region_id.replace("REG_", "REGION_"));
  facets.add(`CREATOR_${e.creator_type}`);
  return [...facets].sort();
}

const entities = seed("entities.json").map((e) => ({ ...e, facets: deriveFacets(e) }));
const byId = new Map(entities.map((e) => [e.entity_id, e]));
const { chambers, wings } = seed("chambers.json");
const artifacts = seed("artifacts.json");

/* ---------------- H3 solvability proof (mirror of vault-engine) ---------------- */
const eraBucket = (y) =>
  y === null ? null : y < 500 ? "ANCIENT" : y < 1500 ? "MEDIEVAL" : y < 1800 ? "EARLY_MODERN" : y < 1900 ? "NINETEENTH" : y < 2000 ? "TWENTIETH" : "TWENTY_FIRST";
const regionOf = (e, rings) => rings.reduce((m, r, i) => m | (e.facets.includes(r.facet) ? 1 << i : 0), 0);
const attrOf = (e, a) =>
  a === "region" ? e.region_id : a === "era" ? eraBucket(e.era_year) : a === "domain" ? e.primary_domain : e.creator_type;
const forgeOk = (e, c) =>
  c.type === "SENSORY" ? e.sensory_tags.includes(c.tag)
  : c.type === "DOMAIN" ? e.primary_domain === c.domain || e.secondary_domain === c.domain
  : c.letters.includes(e.canonical_title.replace(/^(The|A|An)\s+/i, "").charAt(0).toUpperCase());

const failures = [];
const report = [];
for (const spec of chambers) {
  const problems = [];
  const stats = {};
  if (spec.kind === "venn") {
    const regions = new Set(spec.tiles.map((id) => regionOf(byId.get(id), spec.rings)));
    stats.distinctRegions = regions.size;
    if (regions.size < 2) problems.push("all tiles share one region");
    spec.tiles.forEach((id) => { if (!byId.has(id)) problems.push(`unknown tile ${id}`); });
    if (spec.brainstormSocket) {
      const full = (1 << spec.rings.length) - 1;
      stats.brainstormValidAnswers = entities.filter((e) => regionOf(e, spec.rings) === full).length;
      if (stats.brainstormValidAnswers < 15) problems.push(`brainstorm answers ${stats.brainstormValidAnswers} < 15 (H3)`);
    }
  } else if (spec.kind === "chrono") {
    const gears = spec.gears.map((id) => byId.get(id));
    const years = gears.map((g) => g?.era_year);
    if (years.some((y) => y === null || y === undefined)) problems.push("gear without year");
    if (new Set(years).size !== years.length) problems.push("gear years not distinct");
    for (const clue of spec.clues) {
      let ok = true;
      if (clue.type === "GAP_YEARS") ok = years[clue.b] - years[clue.a] === clue.years;
      else if (clue.type === "SAME_REGION") ok = gears[clue.a].region_id === gears[clue.b].region_id;
      else if (clue.type === "BEFORE_YEAR_COUNT") ok = years.filter((y) => y < clue.year).length === clue.count;
      else if (clue.type === "IMMEDIATELY_BEFORE") ok = clue.b === clue.a + 1;
      if (!ok) problems.push(`false clue: ${JSON.stringify(clue)}`);
    }
    stats.gears = spec.gears.length;
  } else if (spec.kind === "forge") {
    const pool = entities.filter((e) => spec.constraints.every((c) => forgeOk(e, c)));
    stats.poolSize = pool.length;
    stats.poolTitles = pool.map((e) => e.canonical_title);
    if (pool.length < spec.answersNeeded) problems.push(`pool ${pool.length} < ${spec.answersNeeded}`);
  } else if (spec.kind === "astrolabe") {
    const ans = byId.get(spec.answer);
    const sig = (e) => ["region", "era", "domain", "creator"].map((a) => attrOf(e, a) ?? "∅").join("|");
    const sigs = spec.candidates.map((id) => sig(byId.get(id)));
    stats.sameSignature = sigs.filter((s) => s === sig(ans)).length;
    if (stats.sameSignature !== 1) problems.push("answer signature not unique");
    const pass = (e, f) => { const eq = attrOf(e, f.attribute) === f.value; return f.keep ? eq : !eq; };
    spec.filters.forEach((f, i) => { if (!pass(ans, f)) problems.push(`answer fails filter ${i + 1}`); });
    const remaining = spec.candidates.filter((id) => spec.filters.every((f) => pass(byId.get(id), f)));
    if (!(remaining.length === 1 && remaining[0] === spec.answer)) problems.push(`filters leave ${remaining.length}, not the answer`);
    stats.candidates = spec.candidates.length;
  }
  report.push({ id: spec.id, kind: spec.kind, ok: problems.length === 0, problems, stats });
  if (problems.length) failures.push({ id: spec.id, problems });
}

/* ---------------- daily vault (M1 pacing) ----------------
   The daily vault is generated canonically by
   pipeline/generate_chambers.py (seeded by date, M1 slot types) and
   committed by the daily-vault workflow. This builder only ensures a
   starter daily exists when none has been generated yet. */
import { existsSync } from "node:fs";
const EPOCH = Date.UTC(2026, 10, 26); // launch day = Daily #001
const today = new Date();
const dateStr = today.toISOString().slice(0, 10);
const dayNum = Math.max(1, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - EPOCH) / 86400000) + 1);
const daily = { date: dateStr, number: dayNum, chambers: ["venn-01", "chrono-01", "forge-01", "venn-02", "astro-01"] };
const dailyExists = existsSync(join(root, "public/data/v1/daily/latest.json"));

/* ---------------- trie shards (autocomplete prefixes) ---------------- */
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const shards = new Map();
for (const e of entities) {
  for (const name of [e.canonical_title, ...e.aliases]) {
    const n = norm(name);
    if (n.length < 2) continue;
    const key = n.slice(0, 2);
    if (!shards.has(key)) shards.set(key, []);
    shards.get(key).push({ id: e.entity_id, t: e.canonical_title, p: n });
  }
}
for (const [key, entries] of shards) {
  const dedup = [...new Map(entries.map((x) => [x.id + x.p, x])).values()];
  out(`trie_shards/${key}.json`, dedup);
}

/* ---------------- write data files ---------------- */
const files = {};
const write = (rel, data) => {
  const s = typeof data === "string" ? data : JSON.stringify(data, null, 1);
  out(rel, s);
  files[rel] = sha(s);
};
write("entities.json", entities);
write("chambers.json", chambers);
write("wings.json", wings);
write("artifacts.json", artifacts);
if (!dailyExists) write("daily/latest.json", daily);
write("manifest.json", {
  version: "1.0.0-starter",
  generatedAt: new Date().toISOString(),
  entityCount: entities.length,
  chamberCount: chambers.length,
  wingCount: wings.length,
  artifactCount: artifacts.length,
  trieShards: shards.size,
  files,
});

console.log(`entities=${entities.length} chambers=${chambers.length} wings=${wings.length} artifacts=${artifacts.length} trieShards=${shards.size}`);
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id} (${r.kind}) ${JSON.stringify(r.stats)}${r.problems.length ? " :: " + r.problems.join("; ") : ""}`);
if (failures.length) {
  console.error(`\nH3 PROOF FAILED for ${failures.length} chamber(s)`);
  process.exit(1);
}
console.log("\nAll chambers pass the H3 solvability proof.");
