/**
 * LUMEN VAULT — app orchestration: hash router, persistent header, the
 * Vault Door (home), constellation maps (Daily Grand Vault · Labyrinth
 * wings · Zen Muse), chambers, the unseal sequence, the daily share card
 * and the Artifact Cabinet. Kinetic Obsidian & Liquid Brass.
 */
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import type { ChamberSpec } from "@lumen-vault/shared-types";
import {
  creativeSparkBonus,
  chamberMastery,
  isRare,
  logicPrecisionBonus,
  renderShareCard,
  starsFor,
  type ChamberResult,
} from "@lumen-vault/vault-engine";
import { loadDataset, type Dataset } from "./data.js";
import { AsmrAudioEngine } from "./engine/AsmrAudioEngine.js";
import { VaultStorageDB, type DailyRunRecord } from "./engine/VaultStorageDB.js";
import { LivingBackground } from "./gfx/Background.js";
import { installSvgDefs, kindIcon, motifSvg } from "./gfx/defs.js";
import { sparkBurst } from "./gfx/sparks.js";
import { renderConstellationMap, type MapNodeState } from "./components/ConstellationMap.js";
import { artifactCardHtml, attachTilt, renderArtifactCabinet } from "./components/ArtifactCabinet.js";
import { CHAMBER_RENDERERS, KIND_LABEL, type ChamberHost, type SolveDetail } from "./components/chambers/index.js";
import { esc, prefersReducedMotion } from "./util.js";
import "./styles.css";

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

type Mode = { name: "daily" } | { name: "wing"; wingId: string } | { name: "zen" };
type View =
  | { kind: "home" }
  | { kind: "map"; mode: Mode }
  | { kind: "chamber"; mode: Mode; chamberId: string }
  | { kind: "share" }
  | { kind: "cabinet"; open?: string };

function modeHash(mode: Mode): string {
  return mode.name === "wing" ? `#/wing/${mode.wingId}` : `#/${mode.name}`;
}

function parseHash(hash: string): View {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (a === "daily") {
    if (b === "share") return { kind: "share" };
    return b ? { kind: "chamber", mode: { name: "daily" }, chamberId: b } : { kind: "map", mode: { name: "daily" } };
  }
  if (a === "zen") return b ? { kind: "chamber", mode: { name: "zen" }, chamberId: b } : { kind: "map", mode: { name: "zen" } };
  if (a === "wing" && b) return c ? { kind: "chamber", mode: { name: "wing", wingId: b }, chamberId: c } : { kind: "map", mode: { name: "wing", wingId: b } };
  if (a === "cabinet") return { kind: "cabinet", open: b };
  return { kind: "home" };
}

function go(hash: string) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const app = document.getElementById("app")!;
const audio = new AsmrAudioEngine();
const storage = new VaultStorageDB();
audio.muted = storage.data.muted;
let data: Dataset;
let background: LivingBackground | null = null;
let disposeView: (() => void) | null = null;
let pendingPour: { modeHash: string; chamberId: string } | null = null;

const PALETTES = [
  { id: "midnight", name: "Midnight Velvet & Champagne Brass" },
  { id: "alabaster", name: "Sunlit Alabaster & Terracotta" },
  { id: "amethyst", name: "Twilight Amethyst & Rose Gold" },
  { id: "jade", name: "Botanical Jade & Warm Copper" },
];

function applyPalette() {
  document.body.dataset.palette = storage.data.palette;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--base").trim() || "#07080c");
  background?.refreshPalette();
}

function announce(text: string) {
  const live = document.getElementById("sr-live");
  if (!live) return;
  live.textContent = "";
  setTimeout(() => (live.textContent = text), 30);
}

/* ------------------------------------------------------------------ */
/* Shell & header                                                      */
/* ------------------------------------------------------------------ */

function shell() {
  app.innerHTML = `
    <a class="skip" href="#view">Skip to content</a>
    <header class="topbar">
      <a class="brand" href="#/" aria-label="Lumen Vault — the Vault Door">
        <svg viewBox="0 0 40 40" class="brand-mark" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="none" stroke="url(#lv-brass)" stroke-width="2.5"/>
          <circle cx="20" cy="20" r="11" fill="none" stroke="url(#lv-brass)" stroke-width="1.2" opacity="0.7"/>
          <circle cx="20" cy="20" r="5" fill="url(#lv-lit)"/>
        </svg>
        <span>LUMEN<span class="brand-gap"> </span>VAULT</span>
      </a>
      <div class="top-stats" aria-live="polite">
        <span class="stat" title="Insight Prisms"><span aria-hidden="true">✦</span> <b id="stat-prisms"></b><span class="sr-only"> Insight Prisms</span></span>
        <a class="stat" href="#/cabinet" title="Wonder Artifacts"><span aria-hidden="true">❖</span> <b id="stat-artifacts"></b><span class="sr-only"> Wonder Artifacts</span></a>
        <span class="stat score" title="Lifetime score"><b id="stat-score"></b></span>
      </div>
      <div class="top-controls">
        <div class="palettes" role="group" aria-label="Palette">
          ${PALETTES.map((p) => `<button type="button" class="swatch sw-${p.id}" data-palette="${p.id}" title="${p.name}" aria-label="${p.name}"></button>`).join("")}
        </div>
        <button type="button" class="btn ghost small" id="sound-toggle"></button>
      </div>
    </header>
    <main id="view" tabindex="-1"></main>
    <footer class="foot"><p>No timers. No fail screens. Only light. · <a href="#/cabinet">Artifact Cabinet</a></p></footer>
    <div id="sr-live" class="sr-only" aria-live="polite"></div>`;
  app.querySelectorAll<HTMLElement>("[data-palette]").forEach((b) =>
    b.addEventListener("click", () => {
      storage.data.palette = b.dataset.palette!;
      storage.save();
      applyPalette();
      updateHeader();
    })
  );
  app.querySelector("#sound-toggle")!.addEventListener("click", () => {
    storage.data.muted = !storage.data.muted;
    storage.save();
    audio.setMuted(storage.data.muted);
    if (!storage.data.muted) audio.brassClick();
    updateHeader();
  });
}

function updateHeader() {
  const p = storage.data;
  app.querySelector("#stat-prisms")!.textContent = String(p.prisms);
  app.querySelector("#stat-artifacts")!.textContent = `${p.artifacts.length}/${data.artifacts.length}`;
  app.querySelector("#stat-score")!.textContent = p.totalScore.toLocaleString("en-US");
  const snd = app.querySelector<HTMLElement>("#sound-toggle")!;
  snd.textContent = p.muted ? "Sound off" : "Sound on";
  snd.setAttribute("aria-pressed", String(!p.muted));
  app.querySelectorAll<HTMLElement>("[data-palette]").forEach((b) => {
    const on = b.dataset.palette === p.palette;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function view(): HTMLElement {
  return app.querySelector<HTMLElement>("#view")!;
}

/* ------------------------------------------------------------------ */
/* Mode helpers                                                        */
/* ------------------------------------------------------------------ */

function sequenceFor(mode: Mode): { title: string; subtitle: string; ids: string[] } | null {
  switch (mode.name) {
    case "daily":
      return {
        title: `Daily Grand Vault #${String(data.daily.number).padStart(3, "0")}`,
        subtitle: `${data.daily.date} (UTC) · Five chambers, one odyssey: warm up, deduce, brainstorm, and finish at the Master Astrolabe. A new vault opens every day.`,
        ids: data.daily.chambers,
      };
    case "wing": {
      const wing = data.wings.find((w) => w.id === mode.wingId);
      if (!wing) return null;
      return { title: wing.title, subtitle: wing.theme, ids: wing.chambers };
    }
    case "zen":
      return {
        title: "Zen Muse Mode",
        subtitle: "Pure brainstorming and lateral light — every forge and open keyhole, all unlocked at once.",
        ids: data.chambers.filter((c) => c.kind === "forge" || (c.kind === "venn" && c.brainstormSocket)).map((c) => c.id),
      };
  }
}

function dailyRun(): DailyRunRecord | undefined {
  return storage.data.dailyRuns[data.daily.date];
}

function nodeStates(mode: Mode, ids: string[]): MapNodeState[] {
  if (mode.name === "daily") {
    const run = dailyRun();
    const solved = ids.map((id) => !!run?.chambers.some((c) => c.chamberId === id));
    return ids.map((id, i) => ({
      id,
      solved: solved[i],
      unlocked: i === 0 || solved[i] || solved[i - 1],
      stars: run?.chambers.find((c) => c.chamberId === id)?.stars ?? 0,
    }));
  }
  const solved = ids.map((id) => storage.isSolved(id));
  return ids.map((id, i) => ({
    id,
    solved: solved[i],
    unlocked: mode.name === "zen" || i === 0 || solved[i] || solved[i - 1],
    stars: storage.data.best[id]?.stars ?? 0,
  }));
}

function pathCodeFor(spec: ChamberSpec): string {
  switch (spec.kind) {
    case "venn":
      return `V${spec.rings.length}`;
    case "chrono":
      return `C${spec.gears.length}`;
    case "forge":
      return "F3";
    case "astrolabe":
      return `A${spec.candidates.length}`;
  }
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function renderHome() {
  const run = dailyRun();
  const dailyDone = run?.chambers.length ?? 0;
  const pct = Math.round((dailyDone / 5) * 100);
  const wings = data.wings
    .map((w) => {
      const solvedCount = w.chambers.filter((id) => storage.isSolved(id)).length;
      const art = data.artifactByChamber.get(w.chambers[w.chambers.length - 1]);
      return `<a class="wing-card" href="#/wing/${w.id}">
        <span class="wing-motif">${art ? motifSvg(art.motif, "wing-motif-svg") : ""}</span>
        <span class="wing-text"><strong>${esc(w.title)}</strong><span>${esc(w.theme)}</span></span>
        <span class="meter small" aria-hidden="true"><span style="width:${(solvedCount / w.chambers.length) * 100}%"></span></span>
        <em>${solvedCount}/${w.chambers.length} unsealed</em>
      </a>`;
    })
    .join("");
  const counts = { venn: 0, chrono: 0, forge: 0, astrolabe: 0 };
  data.chambers.forEach((c) => counts[c.kind]++);

  view().innerHTML = `
    <section class="hero panel">
      <div class="emblem" aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#lv-brass)" stroke-width="3"/>
          <g class="emblem-ring slow"><circle cx="100" cy="100" r="78" fill="none" stroke="url(#lv-brass)" stroke-width="1.2" stroke-dasharray="2 6"/></g>
          <g class="emblem-ring mid"><ellipse cx="100" cy="100" rx="70" ry="34" fill="none" stroke="url(#lv-brass)" stroke-width="1.6"/><circle cx="170" cy="100" r="4" fill="url(#lv-lit)"/></g>
          <g class="emblem-ring fast"><ellipse cx="100" cy="100" rx="34" ry="70" fill="none" stroke="url(#lv-brass)" stroke-width="1.6"/><circle cx="100" cy="30" r="3.5" fill="url(#lv-lit)"/></g>
          <circle cx="100" cy="100" r="22" fill="url(#lv-lit)" filter="url(#lv-glow)"/>
          <circle cx="100" cy="100" r="22" fill="url(#lv-spec)"/>
        </svg>
      </div>
      <div class="hero-text">
        <h1>LUMEN VAULT</h1>
        <p class="tagline">A calm puzzle-adventure in obsidian, glass and liquid brass.</p>
        <p class="hero-copy">Unlock a luminous constellation of ${data.chambers.length} Vault Chambers across ${data.wings.length} wings. Half of every lock is deduction — Venn intersections, chrono gears, astrolabe riddles. The other half is <em>you</em>: open brainstorming under playful runes. No timers. No fail screens. Only light, poured one chamber at a time.</p>
        <div class="hero-cta">
          <a class="btn brass big" href="#/daily">${dailyDone === 5 ? "Review today's vault" : dailyDone ? "Continue today's vault" : "Enter today's vault"}</a>
          <a class="btn ghost big" href="#/cabinet">Artifact Cabinet · ${storage.data.artifacts.length}/${data.artifacts.length}</a>
        </div>
      </div>
    </section>

    <section class="mode-grid">
      <article class="mode-card panel daily-card">
        <div class="ring-progress" style="--p:${pct}" aria-hidden="true"><span>${dailyDone}/5</span></div>
        <div>
          <h2>Daily Grand Vault <span class="badge">#${String(data.daily.number).padStart(3, "0")}</span></h2>
          <p>Five chambers on a gentle pacing curve — a warm-up Venn, a chrono chain, a resonance forge, a gilded intersection and the Master Astrolabe. Same vault for everyone, new every UTC day.</p>
          <a class="btn brass" href="#/daily">${dailyDone === 5 ? "Today's constellation card" : "Enter the vault"}</a>
        </div>
      </article>
      <article class="mode-card panel">
        <h2>Zen Muse Mode</h2>
        <p>Untimed creative synthesis: every Resonance Forge and brainstorm keyhole, all open at once.</p>
        <a class="btn ghost" href="#/zen">Drift in</a>
      </article>
    </section>

    <section class="labyrinth panel">
      <header class="section-head"><h2>The Labyrinth</h2><p>${data.wings.length} thematic wings · ${data.chambers.length} chambers · node-by-node progression</p></header>
      <div class="wing-grid">${wings}</div>
    </section>

    <section class="how panel">
      <h2>How the vault opens</h2>
      <ul class="how-grid">
        <li>${kindIcon("venn")}<div><strong>Venn Lock</strong> · ${counts.venn} chambers<br/>Drag (or tap, then tap) each vellum tile into its exact region. Regions can hold many tiles; some locks ask for one answer of your own.</div></li>
        <li>${kindIcon("chrono")}<div><strong>Chrono Gearbox</strong> · ${counts.chrono} chambers<br/>Engraved plaques fix exactly one order — deduce it, no dates required. Drop a gear on a filled slot to swap.</div></li>
        <li>${kindIcon("forge")}<div><strong>Resonance Forge</strong> · ${counts.forge} chambers<br/>Offer three answers that satisfy every rune. Spelling is forgiving; unknown names never count against you; rare answers spark brighter.</div></li>
        <li>${kindIcon("astrolabe")}<div><strong>Deduction Astrolabe</strong> · ${counts.astrolabe} chambers<br/>Read the riddles, cloud every name they rule out, and focus the lens on the one that remains.</div></li>
      </ul>
      <p class="fine">Insight Prisms — earned by flawless first solves, pairs of rare brainstorms and finishing a daily vault — buy a single-step nudge, and are only spent when the nudge can help.</p>
    </section>`;
}

function renderMap(mode: Mode) {
  const seq = sequenceFor(mode);
  if (!seq) return go("#/");
  const nodes = nodeStates(mode, seq.ids);
  const solvedCount = nodes.filter((n) => n.solved).length;
  const hash = modeHash(mode);
  const pour = pendingPour && pendingPour.modeHash === hash ? pendingPour.chamberId : undefined;
  pendingPour = null;
  view().innerHTML = `
    <nav class="crumbs"><a href="#/">← The Vault Door</a>${mode.name === "daily" && solvedCount === 5 ? ` · <a href="#/daily/share">Today's constellation card</a>` : ""}</nav>
    <div id="map-root"></div>`;
  disposeView = renderConstellationMap(view().querySelector("#map-root")!, {
    title: seq.title,
    subtitle: seq.subtitle,
    progressLabel: `${solvedCount}/${nodes.length} unsealed${mode.name === "daily" ? " today" : ""}`,
    nodes,
    chamberById: data.chamberById,
    pourFrom: pour,
    onOpen: (id) => go(`${hash}/${id}`),
    onPour: () => audio.goldPour(1.2),
  });
}

function renderCabinet(open?: string) {
  view().innerHTML = `<nav class="crumbs"><a href="#/">← The Vault Door</a></nav><div id="cabinet-root"></div>`;
  renderArtifactCabinet(view().querySelector("#cabinet-root")!, data.artifacts, data.wings, data.chamberById, new Set(storage.data.artifacts), open);
}

function renderChamber(mode: Mode, chamberId: string) {
  const spec = data.chamberById.get(chamberId);
  const seq = sequenceFor(mode);
  const hash = modeHash(mode);
  if (!spec || !seq || !seq.ids.includes(chamberId)) return go(seq ? hash : "#/");
  const idx = seq.ids.indexOf(chamberId);
  if (!nodeStates(mode, seq.ids)[idx].unlocked) return go(hash);

  const openedAt = performance.now();
  let nudges = 0;
  const solvedBefore = mode.name === "daily" ? storage.dailySolved(data.daily.date, chamberId) : storage.isSolved(chamberId);
  view().innerHTML = `
    <nav class="crumbs"><a href="${hash}">← ${esc(seq.title)}</a><span class="crumb-pos">Chamber ${idx + 1} of ${seq.ids.length}</span></nav>
    <section class="chamber panel kind-${spec.kind}">
      <header class="chamber-head">
        <span class="chamber-icon">${kindIcon(spec.kind)}</span>
        <div>
          <p class="chamber-kind">${KIND_LABEL[spec.kind]} · ${solvedBefore ? "Unsealed — replay for the love of it" : "Sealed"}</p>
          <h2>${esc(spec.title)}</h2>
        </div>
      </header>
      <p class="intro">${esc(spec.intro)}</p>
      <p class="chamber-meta"><span>✦ Prisms <strong id="prism-count">${storage.data.prisms}</strong></span><span>Nudges used <strong id="nudge-count">0</strong></span></p>
      <p id="chamber-msg" class="msg" role="status" aria-live="polite"></p>
      <div id="chamber-body"></div>
    </section>`;
  const msgEl = view().querySelector<HTMLElement>("#chamber-msg")!;
  const host: ChamberHost = {
    audio,
    announce,
    msg: (text, kind = "info") => {
      msgEl.textContent = text;
      msgEl.className = `msg ${kind}`;
      msgEl.classList.remove("pulse");
      void msgEl.offsetWidth;
      msgEl.classList.add("pulse");
    },
    prisms: () => storage.data.prisms,
    spendPrism: () => {
      if (!storage.spendPrism()) return false;
      nudges++;
      view().querySelector("#prism-count")!.textContent = String(storage.data.prisms);
      view().querySelector("#nudge-count")!.textContent = String(nudges);
      updateHeader();
      return true;
    },
    solve: (detail) => onSolve(mode, spec, detail, nudges, Math.max(1, Math.round((performance.now() - openedAt) / 1000))),
  };
  CHAMBER_RENDERERS[spec.kind](view().querySelector("#chamber-body")!, spec, data, host);
}

/* ------------------------------------------------------------------ */
/* Unseal sequence                                                     */
/* ------------------------------------------------------------------ */

function countUp(el: HTMLElement, to: number, ms = 900) {
  if (prefersReducedMotion()) {
    el.textContent = to.toLocaleString("en-US");
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString("en-US");
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function onSolve(mode: Mode, spec: ChamberSpec, detail: SolveDetail, nudges: number, seconds: number) {
  const wrong = detail.wrongPlacements;
  const score = chamberMastery(wrong, detail.brainstormTerms);
  const flawless = wrong === 0 && nudges === 0;
  const stars = starsFor(wrong, nudges);
  const artifact = data.artifactByChamber.get(spec.id);
  const first = !storage.isSolved(spec.id);

  let prismsGained = 0;
  if (first) {
    if (flawless) prismsGained += 1;
    const rare = detail.brainstormTerms.filter(isRare).length;
    const before = storage.data.rareBrainstormCount;
    storage.addRareBrainstorms(rare);
    prismsGained += Math.floor(storage.data.rareBrainstormCount / 2) - Math.floor(before / 2);
  }
  storage.recordSolve(spec.id, artifact?.id, score, stars);

  let dailyFinishedNow = false;
  if (mode.name === "daily") {
    const key = data.daily.date;
    const run = storage.data.dailyRuns[key] ?? { date: key, number: data.daily.number, chambers: [], finished: false, totalScore: 0, prismsEarned: 0 };
    if (!run.chambers.some((c) => c.chamberId === spec.id)) {
      run.chambers.push({ chamberId: spec.id, stars, score, seconds, nudges, wrong });
      run.totalScore += score;
      run.prismsEarned += prismsGained;
    }
    const finished = data.daily.chambers.every((id) => run.chambers.some((c) => c.chamberId === id));
    if (finished && !run.finished) {
      dailyFinishedNow = true;
      prismsGained += 1; // daily seal bonus
      run.prismsEarned += 1;
    }
    run.finished = finished;
    storage.data.dailyRuns[key] = run;
    storage.save();
  }
  if (prismsGained > 0) storage.addPrisms(prismsGained);
  updateHeader();

  const hash = modeHash(mode);
  pendingPour = { modeHash: hash, chamberId: spec.id };
  const seq = sequenceFor(mode)!;
  const nextId = seq.ids[seq.ids.indexOf(spec.id) + 1];

  // 1. Glow, sparks and chime.
  const panel = view().querySelector<HTMLElement>(".chamber")!;
  panel.classList.add("unsealing");
  const body = view().querySelector<HTMLElement>("#chamber-body")!;
  const r = body.getBoundingClientRect();
  sparkBurst(r.left + r.width / 2, Math.min(innerHeight * 0.6, Math.max(80, r.top + Math.min(r.height / 2, 260))), 110, getComputedStyle(document.body).getPropertyValue("--brass").trim() || "#e5c17b");
  audio.unsealChime();
  audio.goldPour();
  announce(`Chamber unsealed. ${stars} of 3 stars. Chamber mastery ${score}.`);

  // 2. The reward.
  const delay = prefersReducedMotion() ? 0 : 750;
  setTimeout(() => {
    panel.classList.remove("unsealing");
    panel.classList.add("unsealed-panel");
    const notes = [flawless ? "Flawless" : "", prismsGained ? `+${prismsGained} Insight Prism${prismsGained > 1 ? "s" : ""}` : "", first ? "" : "Replay — score not added again"].filter(Boolean).join(" · ");
    body.innerHTML = `
      <div class="unsealed">
        <div class="gold-burst" aria-hidden="true"></div>
        <h3>Chamber unsealed</h3>
        <p class="stars-line" aria-label="${stars} of 3 stars"><span class="star ${stars >= 1 ? "on" : ""}">★</span><span class="star ${stars >= 2 ? "on" : ""}">★</span><span class="star ${stars >= 3 ? "on" : ""}">★</span></p>
        ${notes ? `<p class="unsealed-note">${notes}</p>` : ""}
        <div class="score-lines">
          <p><span>Base solve</span><strong data-count="500">0</strong></p>
          <p><span>Logic precision (${wrong} misstep${wrong === 1 ? "" : "s"})</span><strong data-count="${logicPrecisionBonus(wrong)}">0</strong></p>
          <p><span>Creative spark</span><strong data-count="${creativeSparkBonus(detail.brainstormTerms)}">0</strong></p>
          <p class="total"><span>Chamber mastery</span><strong data-count="${score}">0</strong></p>
        </div>
        ${detail.reveal ?? ""}
        ${artifact ? `<div class="reward"><p class="reward-label">${first ? "A Wonder Artifact surfaces" : "Its Wonder Artifact"}</p>${artifactCardHtml(artifact, "reveal")}</div>` : ""}
        <div class="chamber-actions centered">
          ${mode.name === "daily" && dailyFinishedNow ? `<a class="btn brass big" href="#/daily/share">Today's constellation card</a>` : ""}
          ${nextId ? `<a class="btn brass big" id="next-chamber" href="${hash}">Pour the light onward</a>` : `<a class="btn brass big" href="${hash}">Return to the constellation</a>`}
          <a class="btn ghost" href="#/cabinet${artifact ? `/${artifact.id}` : ""}">Open the cabinet</a>
        </div>
      </div>`;
    body.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => countUp(el, Number(el.dataset.count)));
    const card = body.querySelector<HTMLElement>(".artifact-card");
    if (card) attachTilt(card);
    body.querySelector<HTMLElement>(".unsealed h3")?.focus?.();
    body.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, delay);
}

/* ------------------------------------------------------------------ */
/* Daily share                                                         */
/* ------------------------------------------------------------------ */

function renderDailyShare() {
  const run = dailyRun();
  if (!run || run.chambers.length === 0) return go("#/daily");
  const results: ChamberResult[] = data.daily.chambers.map((id) => {
    const spec = data.chamberById.get(id)!;
    const rec = run.chambers.find((c) => c.chamberId === id);
    return { kind: spec.kind, stars: rec?.stars ?? 0, nudges: rec?.nudges, wrong: rec?.wrong, pathCode: pathCodeFor(spec) };
  });
  const card = renderShareCard({
    dailyNumber: run.number,
    cleared: run.chambers.length,
    total: data.daily.chambers.length,
    timeSeconds: run.chambers.reduce((s, c) => s + c.seconds, 0),
    score: run.totalScore,
    prisms: run.prismsEarned,
    chambers: results,
    goldRun: run.finished && run.chambers.every((c) => c.stars === 3),
  });
  view().innerHTML = `
    <nav class="crumbs"><a href="#/daily">← Daily Grand Vault</a></nav>
    <section class="panel share-wrap">
      <h2>Today's Constellation Card</h2>
      <p class="map-sub">Daily Grand Vault #${String(run.number).padStart(3, "0")} · ${esc(run.date)} (UTC)</p>
      <pre class="share-card" tabindex="0" aria-label="Share card text">${esc(card)}</pre>
      <div class="chamber-actions centered">
        <button type="button" class="btn brass" id="copy-share">Copy the card</button>
        ${typeof navigator !== "undefined" && "share" in navigator ? `<button type="button" class="btn ghost" id="native-share">Share…</button>` : ""}
        <a class="btn ghost" href="#/daily">Return to the constellation</a>
      </div>
    </section>`;
  view().querySelector("#copy-share")!.addEventListener("click", async (ev) => {
    const btn = ev.currentTarget as HTMLElement;
    try {
      await navigator.clipboard.writeText(card);
      btn.textContent = "Copied ✦";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(view().querySelector(".share-card")!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      btn.textContent = "Selected — copy it by hand";
    }
  });
  view().querySelector("#native-share")?.addEventListener("click", () => {
    void navigator.share?.({ title: "LUMEN VAULT", text: card }).catch(() => {});
  });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

function render() {
  disposeView?.();
  disposeView = null;
  document.body.classList.remove("placing", "dragging");
  scrollTo({ top: 0, behavior: "auto" });
  const v = parseHash(location.hash);
  switch (v.kind) {
    case "home":
      renderHome();
      break;
    case "map":
      renderMap(v.mode);
      break;
    case "chamber":
      renderChamber(v.mode, v.chamberId);
      break;
    case "share":
      renderDailyShare();
      break;
    case "cabinet":
      renderCabinet(v.open);
      break;
  }
  updateHeader();
  const main = view();
  if (document.activeElement && document.activeElement !== document.body && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
}

async function boot() {
  installSvgDefs();
  applyPalette();
  try {
    background = new LivingBackground(document.body);
  } catch {
    background = null;
  }
  try {
    data = await loadDataset();
  } catch (err) {
    app.innerHTML = `<main class="boot-error"><section class="panel hero">
      <div class="hero-text"><h1>LUMEN VAULT</h1>
      <p class="tagline">The vault's dataset could not be reached.</p>
      <p class="hero-copy">${esc(err instanceof Error ? err.message : String(err))}</p></div>
    </section></main>`;
    return;
  }
  shell();
  applyPalette();
  addEventListener("hashchange", render);
  render();
}

void boot();
