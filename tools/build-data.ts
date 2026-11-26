/**
 * LUMEN VAULT data builder — `npm run data` (runs under vite-node).
 *
 * Inputs (never modified here):
 *   tools/seed/entities/*.txt   curated entities
 *   tools/seed/ingested.json    pipeline-ingested entities (optional)
 *   tools/seed/chambers.ts      wing + chamber recipes with artifact lore
 * Output: public/data/v1/{entities,chambers,wings,artifacts,manifest}.json
 *         and daily/latest.json (a fallback; the client computes the daily
 *         vault itself from the UTC date).
 *
 * Chrono plaques, astrolabe riddles and forge initial-runes are generated
 * deterministically, then every chamber is PROVEN with the vault-engine
 * verifier. Any failure exits non-zero and writes nothing.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ArtifactCard,
  AstrolabeChamberSpec,
  ChamberSpec,
  ChronoChamberSpec,
  Entity,
  ForgeChamberSpec,
  ForgeConstraint,
  VennChamberSpec,
  WingSpec,
} from "@lumen-vault/shared-types";
import {
  chooseInitialLetters,
  dailyVaultFor,
  fnv1a,
  generateAstrolabeClues,
  generateChronoClues,
  satisfiesAllConstraints,
  utcDateString,
  verifyAllChambers,
  MIN_FORGE_POOL,
} from "@lumen-vault/vault-engine";
import { DOMAIN, DOMAIN_RUNE, ROOT, SENSORY_RUNE, facetLabel, loadEntities } from "./lib/seed.js";
import { WINGS, type ChamberRecipe, type RuneRecipe } from "./seed/chambers.js";

export const FRAMES = ["ring", "diamond", "rays", "arch"] as const;

export interface BuiltData {
  entities: Entity[];
  chambers: ChamberSpec[];
  wings: WingSpec[];
  artifacts: ArtifactCard[];
}

function resolver(entities: Entity[]) {
  const byTitle = new Map<string, Entity[]>();
  for (const e of entities) {
    const k = e.canonical_title.toLowerCase();
    byTitle.set(k, [...(byTitle.get(k) ?? []), e]);
  }
  return (ref: string, where: string): string => {
    const [title, dom] = ref.split("@");
    let hits = byTitle.get(title.toLowerCase()) ?? [];
    if (dom) hits = hits.filter((e) => e.primary_domain === DOMAIN[dom]);
    if (hits.length !== 1) throw new Error(`${where}: reference "${ref}" matched ${hits.length} entities`);
    return hits[0].entity_id;
  };
}

function runeFor(r: RuneRecipe): ForgeConstraint {
  if ("sensory" in r) return { type: "SENSORY", tag: r.sensory, label: SENSORY_RUNE[r.sensory] };
  if ("domain" in r) {
    const domain = DOMAIN[r.domain];
    if (!domain) throw new Error(`Unknown domain ${r.domain}`);
    return { type: "DOMAIN", domain, label: DOMAIN_RUNE[domain] };
  }
  return { type: "FACET", facet: r.facet, label: facetLabel(r.facet) };
}

function lettersLabel(letters: string[]): string {
  if (letters.length === 1) return `Starts with ${letters[0]}`;
  return `Starts with ${letters.slice(0, -1).join(", ")} or ${letters[letters.length - 1]}`;
}

export function buildAll(): BuiltData {
  const entities = loadEntities();
  const byId = new Map(entities.map((e) => [e.entity_id, e]));
  const ref = resolver(entities);
  const counters: Record<string, number> = { venn: 0, chrono: 0, forge: 0, astrolabe: 0 };
  const prefix: Record<string, string> = { venn: "venn", chrono: "chrono", forge: "forge", astrolabe: "astro" };
  const chambers: ChamberSpec[] = [];
  const wings: WingSpec[] = [];
  const artifacts: ArtifactCard[] = [];
  const usedMotifs = new Set<string>();

  const build = (r: ChamberRecipe): ChamberSpec => {
    counters[r.kind]++;
    const id = `${prefix[r.kind]}-${String(counters[r.kind]).padStart(2, "0")}`;
    const where = `${id} (${r.title})`;
    const seed = fnv1a(id);
    switch (r.kind) {
      case "venn": {
        const spec: VennChamberSpec = {
          kind: "venn",
          id,
          title: r.title,
          intro: r.intro,
          rings: r.rings.map((facet) => ({ facet, label: facetLabel(facet) })),
          tiles: r.tiles.map((t) => ref(t, where)),
          brainstormSocket: !!r.brainstorm,
        };
        return spec;
      }
      case "chrono": {
        const gears = r.gears.map((t) => ref(t, where));
        const order = [...gears].sort((a, b) => byId.get(a)!.era_year! - byId.get(b)!.era_year!);
        const clues = generateChronoClues(order, (gid) => byId.get(gid)!.era_year!, seed);
        const spec: ChronoChamberSpec = { kind: "chrono", id, title: r.title, intro: r.intro, gears, clues };
        return spec;
      }
      case "forge": {
        const base = r.runes.map(runeFor);
        const pool = entities.filter((e) => satisfiesAllConstraints(e, base));
        const letters = chooseInitialLetters(pool, Math.max(MIN_FORGE_POOL, Math.ceil(pool.length * 0.6)));
        const constraints = [...base, { type: "INITIALS" as const, letters, label: lettersLabel(letters) }];
        const spec: ForgeChamberSpec = { kind: "forge", id, title: r.title, intro: r.intro, constraints, answersNeeded: 3 };
        return spec;
      }
      case "astrolabe": {
        const answer = ref(r.answer, where);
        const others = r.candidates.map((t) => ref(t, where));
        // Answer position on the dial is seeded, never first.
        const pos = 1 + (seed % others.length);
        const candidates = [...others.slice(0, pos), answer, ...others.slice(pos)];
        const clues = generateAstrolabeClues(answer, candidates, byId, seed);
        const spec: AstrolabeChamberSpec = { kind: "astrolabe", id, title: r.title, intro: r.intro, answer, candidates, clues };
        return spec;
      }
    }
  };

  for (const w of WINGS) {
    const ids: string[] = [];
    for (const r of w.chambers) {
      const spec = build(r);
      chambers.push(spec);
      ids.push(spec.id);
      const frame = FRAMES.find((f) => !usedMotifs.has(`${r.artifact.glyph}:${f}`));
      if (!frame) throw new Error(`Glyph ${r.artifact.glyph} used more than ${FRAMES.length} times`);
      const motif = `${r.artifact.glyph}:${frame}`;
      usedMotifs.add(motif);
      artifacts.push({
        id: `ART-${String(artifacts.length + 1).padStart(2, "0")}`,
        chamberId: spec.id,
        name: r.artifact.name,
        motif,
        lore: r.artifact.lore,
      });
    }
    wings.push({ id: w.id, title: w.title, theme: w.theme, chambers: ids });
  }
  return { entities, chambers, wings, artifacts };
}

function main() {
  const data = buildAll();
  const proofs = verifyAllChambers(data.chambers, data.entities);
  const failures = proofs.filter((p) => !p.ok);
  const names = new Set<string>();
  for (const a of data.artifacts) {
    if (names.has(a.name)) failures.push({ chamberId: a.chamberId, ok: false, problems: [`duplicate artifact name ${a.name}`], stats: {} });
    names.add(a.name);
  }
  for (const p of proofs) console.log(`${p.ok ? "PASS" : "FAIL"} ${p.chamberId} ${JSON.stringify(p.stats)}${p.problems.length ? " :: " + p.problems.join("; ") : ""}`);
  if (failures.length) {
    console.error(`\nPROOF FAILED for ${failures.length} chamber(s) — nothing written.`);
    for (const f of failures) console.error(`  ${f.chamberId}: ${f.problems.join("; ")}`);
    process.exit(1);
  }

  const outDir = join(ROOT, "public", "data", "v1");
  const files: Record<string, string> = {};
  const write = (rel: string, value: unknown, onePerLine = false) => {
    const path = join(outDir, rel);
    mkdirSync(dirname(path), { recursive: true });
    // Large arrays: one record per line — compact for the client, still diff-friendly.
    const s = onePerLine && Array.isArray(value) ? `[\n${value.map((v) => JSON.stringify(v)).join(",\n")}\n]\n` : JSON.stringify(value, null, 1) + "\n";
    writeFileSync(path, s, "utf8");
    files[rel] = createHash("sha256").update(s).digest("hex").slice(0, 16);
  };
  write("entities.json", data.entities, true);
  write("chambers.json", data.chambers);
  write("wings.json", data.wings);
  write("artifacts.json", data.artifacts);
  write("daily/latest.json", dailyVaultFor(utcDateString(), data.chambers));
  const legacyShards = join(outDir, "trie_shards");
  if (existsSync(legacyShards)) rmSync(legacyShards, { recursive: true, force: true });
  write("manifest.json", {
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    entityCount: data.entities.length,
    chamberCount: data.chambers.length,
    wingCount: data.wings.length,
    artifactCount: data.artifacts.length,
    files,
  });
  const byDomain: Record<string, number> = {};
  for (const e of data.entities) byDomain[e.primary_domain] = (byDomain[e.primary_domain] ?? 0) + 1;
  const byKind: Record<string, number> = {};
  for (const c of data.chambers) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  console.log(`\nentities=${data.entities.length} ${JSON.stringify(byDomain)}`);
  console.log(`chambers=${data.chambers.length} ${JSON.stringify(byKind)} wings=${data.wings.length} artifacts=${data.artifacts.length}`);
  console.log("All chambers pass the solvability proof.");
}

main();
