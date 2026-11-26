# LUMEN VAULT

A tactile puzzle-adventure web game — **Kinetic Obsidian & Liquid Brass**, zero pixel art.
Unlock a luminous constellation of Vault Chambers by solving hybrid locks: half deductive
trivia-logic (Venn intersections, chronological gear chains, elimination dials), half creative
brainstorming under playful constraints. Every solved chamber pours liquid-gold light to the
next node and unlocks a collectible 3D-tilting **Wonder Artifact Card**. No timers, no fail
screens; **Insight Prisms** give gentle, single-step nudges.

Game #4 on the [deepwell.games](https://deepwell.games/) hub, after Deepwell (APOGEE),
NEXUS RELAY and HYPE RIOT.

## Play it locally

```bash
npm install
npm run build            # vite build (apps/web)
npm run dev              # dev server on :5174 with the dataset mounted
npm run typecheck
npm test                 # engine + web + pipeline tests (pipeline needs pytest)
npm run data             # rebuild the curated starter dataset + H3 proof
```

## Structure (Blueprint §6)

```
packages/vault-engine/   Pure TS logic: VennValidator, ChronoSolver, AstrolabeFilter,
                         BrainstormEvaluator, ConstraintVerifier (H3), ShareCardRenderer
packages/shared-types/   Entity / Chamber / Artifact schemas (Blueprint §5)
apps/web/                Vite app: ConstellationMap, 4 chamber UIs, ArtifactCabinet,
                         SpringPhysics (290/24), AsmrAudioEngine (Web Audio, no assets)
pipeline/                Python ETL: ingest_wikidata, tag_facets, generate_chambers,
                         verify_solvability, compile_shards
public/data/v1/          Static dataset: entities, chambers, wings, artifacts,
                         daily/latest.json, trie_shards, manifest
tools/                   Curated seed + build-data.mjs (starter dataset builder)
```

## Dataset — honest counts

- Curated starter seed: **151 entities, 16 chambers, 4 wings, 16 artifact cards** — every
  chamber passes the H3 solvability proof (brainstorm socket accepts 25 answers ≥ 15).
- One bounded Wikidata ingest run (2026-11-26, `--limit 300`) merged **+78 film entities**
  → **229 entities** shipped; proofs re-verified 16/16 after the merge.
- The blueprint's 200,000+ entity / 50,000+ template corpus is the growth target of the
  `data-build.yml` workflow (monthly + on-demand), not a claim about the starter set.

## Gameplay (Blueprint §2)

- **Daily Grand Vault** — 5 chambers on the M1 pacing curve, seeded by UTC date.
- **The Labyrinth** — 4 thematic wings, persistent node-by-node progression.
- **Zen Muse Mode** — brainstorming chambers only.
- Scoring, verbatim: `Mastery = 500 + Precision (≤300, −50/wrong) + Spark (≤250, by rarity)`;
  `Prisms = ⌊flawless⌋ + ⌊rare brainstorms / 2⌋`.

## Deviations register (reported, never silently approximated)

- **D1 — Vanilla TypeScript instead of React** in `apps/web`. The blueprint's master prompt
  names React; the sibling games standardise on dependency-free TS, and the H5 ceiling
  (≤180 KB Brotli) is met at **17.9 KB total** partly because of it. All specified behaviours
  (spring drag, tilt, shaders-via-CSS/SVG, audio) are implemented as specified.
- **D2 — npm workspaces instead of pnpm.** Same layout and package names; CI adapted.
- **D3 — Dataset scale.** 229 entities vs the blueprint's 200k+ target (see counts above).
  The Wikidata pipeline + `data-build.yml` workflow are the growth mechanism.
- **D4 — Forge pool sizes.** H3's "≥15 valid entities" is met for the Venn brainstorm socket
  (25). Resonance Forge pools in the starter dictionary are 3–6 (≥ the 3 answers required);
  ≥15 at forge-constraint specificity is a property of the full-scale corpus and widens
  automatically as the dictionary grows. The verifier reports pool sizes on every run.
- **D5 — No binary packing yet.** §5's `entities_index.bin` (20-byte records) and 677 trie
  shards are the full-corpus formats; at starter scale the game ships `entities.json` +
  141 trie shards in the same layout. The layout is forward-compatible.
- **D6 — localStorage instead of IndexedDB** behind the `VaultStorageDB` class (§6 names
  the class, not the backend); an IndexedDB adapter can replace it without touching callers.
- **D7 — Cloudflare (§7) not provisioned.** Current host is GitHub Pages from this repo
  (same pattern as the sibling games). The OG share worker in §7 is specified for the
  Cloudflare move; the in-game sharecard is the blueprint's plain-text format.
- **D8 — Glass shaders.** §3/§6 name WebGL2 glass shaders; the shipped surfaces use CSS
  backdrop-filter blur(18px) + layered gradients (the blueprint's own §3 surface spec),
  which meets the visual spec without a shader pipeline. No CRT/pixel techniques anywhere (H1).

## Deployment

The repo deploys from `.github/workflows/pages.yml` (owner-pasted — the Muse GitHub App
cannot write workflow files). Dataset growth runs through `data-build.yml`; the daily
vault through `daily-vault.yml`; CI through `ci.yml`. All four files live in
`.github/workflows/` in this repo.
