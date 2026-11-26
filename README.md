# LUMEN VAULT

A calm puzzle-adventure in **obsidian and liquid brass**. Unlock a luminous constellation of
Vault Chambers: half of every lock is deduction (Venn intersections, chrono gears, astrolabe
riddles), the other half is you — open brainstorming under playful runes. Every solved chamber
pours liquid-gold light to the next node and reveals a collectible, tilting **Wonder Artifact
Card**. No timers. No fail screens. Insight Prisms buy gentle, single-step nudges.

Live: https://muhammad3056725-eng.github.io/Lumen-vault/

## Play it locally

```bash
npm ci
npm run dev          # http://localhost:5174 — the dataset is mounted from public/
npm run typecheck
npm test             # engine + web (jsdom) tests, then the Python pipeline tests
                     # (skipped with a notice if no Python with pytest+requests is found)
npm run build        # apps/web/dist (copy public/ beside it to deploy, as pages.yml does)
npm run data         # rebuild public/data/v1 from tools/seed and re-prove every chamber
```

## What's in the vault (honest counts)

| | |
|---|---|
| Entities | **766** hand-curated, fact-checked: film 91 · animals 74 · literature 71 · nature 68 · music 62 · mythology 56 · engineering 56 · art 53 · inventions 47 · video games 46 · food 46 · space exploration 40 · science 39 · sport 17 |
| Chambers | **64** — 16 Venn Locks (8 two-ring, 8 three-ring, 7 with brainstorm sockets), 16 Chrono Gearboxes (8 × 4 gears, 8 × 5 gears), 16 Resonance Forges, 16 Deduction Astrolabes |
| Wings | **8** × 8 chambers: Cinema & Sound · Inventions & Science · Myth & World Wonders · Art & Letters · Wild Earth · Stars & Machines · Hearth & Play · Lateral Riddles |
| Artifacts | **64** — one per chamber, each with a unique vector motif (`glyph:frame`) and two sentences of factual lore (no invented quotations) |

Every chamber is machine-proved by the TypeScript engine (`npm run data`, `npm test`) **and**
by an independent Python mirror (`pipeline/verify_solvability.py`):

- **Venn** — tiles distinct; ≥2 regions (≥3 with three rings); any number of tiles may share a
  region; brainstorm sockets accept ≥15 dictionary entries.
- **Chrono** — distinct years; every plaque is a fact about the *true* chronological positions;
  the plaques alone admit **exactly one** ordering; no single plaque suffices.
- **Forge** — three runes; ≥8 valid answers in the dictionary.
- **Astrolabe** — every riddle is true of the hidden artifact and rules something out; no riddle
  alone gives it away; all riddles together leave exactly one candidate.

## How it plays

- **Venn Lock** — drag a vellum tile onto a region of the diagram or onto its row in the region
  ledger, *or* tap a tile and then tap where it belongs (also fully keyboard operable: Enter to
  lift, Enter to place, Escape to cancel). The tray is a drop target too. Seal when every tile
  is placed; wrong tiles glide back and count as missteps.
- **Chrono Gearbox** — seat each event in a gear slot (dropping on a filled slot swaps). The
  engraved plaques fix one order; no dates are needed.
- **Resonance Forge** — type three answers that satisfy every rune. Matching forgives typos,
  accents, apostrophes, leading articles, number words, Roman numerals, partial names ("night
  music") and resolves same-title entries by the runes ("Dune" the novel vs the film). Unknown
  names never count against you; only known answers that break a rune do.
- **Deduction Astrolabe** — names only on the dial. Read the riddles, tap names to cloud the ones
  they rule out, then focus the lens on the one that remains. Each candidate's region, era, field
  and maker are revealed afterwards, with the riddle that ruled it out.
- **Insight Prisms** — start with 3; +1 per flawless first solve, +1 per two rare brainstorm
  answers, +1 for finishing a daily vault. A prism is only spent when the nudge can actually help.
- **Scoring** — Mastery = 500 + Logic Precision (300 − 50 per misstep, floor 0) + Creative Spark
  (≤250, rarer answers burn brighter). Stars = 3 − nudges − (any missteps ? 1 : 0), floor 1.

### Modes

- **Daily Grand Vault** — five chambers on a pacing curve (2-ring Venn → 4-gear chain → forge →
  brainstorm Venn → astrolabe), **computed in the browser from the UTC date** (FNV-1a over
  `date:slot`), so it rotates every day with no server or workflow. `pipeline/generate_chambers.py`
  mirrors the same algorithm; tests pin both to identical output. Progress, stars and the
  plain-text share card are per day.
- **The Labyrinth** — 8 wings, node-by-node progression; all 64 artifacts are collectable.
- **Zen Muse Mode** — every forge and brainstorm keyhole, all unlocked at once.
- **Artifact Cabinet** — gallery grouped by wing with filters; collected cards open large.

URLs are hash-routed (`#/daily`, `#/wing/<id>/<chamber>`, `#/cabinet/<ART-id>` …), so the
browser back button works.

## Graphics

- Living background: a WebGL fragment shader of slow liquid-brass caustics and two parallax
  layers of dust motes over obsidian (Canvas2D fallback), DPR capped at 2 with a ~1.6 MP fill
  budget, paused when the tab is hidden, a single still frame under `prefers-reduced-motion`.
- Metallic SVG gradients and specular highlights shared through one `<defs>` block; medallion
  nodes; conduits that literally pour gold to the next node after a solve; an unseal sequence
  (panel glow, gold-spark particle burst, synthesized chime, counting score, card flip-in);
  holographic, tilting artifact cards.
- Fonts are bundled from npm (`@fontsource/cinzel`, `@fontsource/inter`) — no CDN.
- Four palettes (Midnight, Alabaster, Amethyst, Jade); only the sticky top bar uses
  `backdrop-filter`. Mobile-first: no horizontal overflow at 360 px; wider two-column chamber
  layouts on desktop. Visible focus rings; reduced-motion respected throughout.
- Sound is fully synthesized with Web Audio (no audio files); the reverb impulse is cached and
  every per-sound node is disconnected afterwards.

## Structure

```
packages/vault-engine/   Pure TS: matching (normalize.ts), Venn, Chrono solver + clue generator,
                         Astrolabe riddles + generator, Forge, proofs, scoring, daily vault, share card
packages/shared-types/   Entity / Chamber / Artifact / Wing schemas
apps/web/                Vite app (vanilla TS): router, placement controller (drag/tap/keyboard),
                         four chamber views, constellation map, cabinet, WebGL background
tools/seed/entities/     Curated entities, one per line (id|title|year|region|domain|creator|...)
tools/seed/chambers.ts   Wing + chamber recipes with artifact lore
tools/seed/ingested.json Pipeline-ingested entities (appended, never overwritten)
tools/build-data.ts      `npm run data`: resolve, generate clues, prove, write public/data/v1
pipeline/                Python: ingest_wikidata, tag_facets, verify_solvability, generate_chambers
public/data/v1/          Shipped dataset: entities, chambers, wings, artifacts, manifest,
                         daily/latest.json (fallback only)
```

## Data pipeline

`npm run data` only reads seeds and writes `public/data/v1`; it never deletes curated or
ingested entities, and refuses to write anything if a single proof fails.

The monthly `data-build.yml` workflow ingests notable works from Wikidata (ordered by sitelink
count, minimum sitelinks configurable, pornographic/erotic genres excluded, bare-QID labels
dropped, region from country of origin only, notability derived from sitelinks), appends new
ones to `tools/seed/ingested.json` with collision-free ids, rebuilds and re-proves the data,
runs all tests, commits, and then calls `pages.yml` to deploy.

Earlier ingests were removed from the shipped data: they included bare-QID titles, wrong
regions, a constant notability, and adult films.

## Deployment

`pages.yml` (push to main, manual, or called by `data-build.yml`): `npm ci` → typecheck → all tests
(Python included) → build → copy `public/` beside the build → deploy to GitHub Pages. Vite's
`base` is `./`, so the build works at any sub-path. `ci.yml` runs the same checks on pull
requests and also verifies that `npm run data` reproduces the committed dataset.

## Notes on facts

Region is where a work was made (Soviet missions are listed under Europe, where they were
designed and built). "Won a competitive Oscar" excludes honorary and special-achievement awards
(so Toy Story and Total Recall do not qualify); songs carry it only if they won Best Original
Song. Years are first release / completion / launch; anonymous or traditional works are dated
only when a date is well established, otherwise they are timeless.
