/**
 * LUMEN VAULT — app orchestration (Blueprint §1 loop, §2 modes):
 * Daily Grand Vault · The Labyrinth wings · Zen Muse Mode ·
 * Artifact Cabinet. Kinetic Obsidian & Liquid Brass, zero pixel art.
 */
import type { ChamberSpec, Entity } from "@lumen-vault/shared-types";
import {
  chamberMastery,
  creativeSparkBonus,
  isRare,
  logicPrecisionBonus,
  renderShareCard,
  type ChamberResult,
} from "@lumen-vault/vault-engine";
import { loadDataset, type Dataset } from "./data.js";
import { AsmrAudioEngine } from "./engine/AsmrAudioEngine.js";
import { VaultStorageDB } from "./engine/VaultStorageDB.js";
import { renderConstellationMap } from "./components/ConstellationMap.js";
import { artifactCardHtml, renderArtifactCabinet } from "./components/ArtifactCabinet.js";
import { attachTilt } from "./components/drag.js";
import { CHAMBER_RENDERERS, type ChamberHost, type SolveDetail } from "./components/chambers.js";
import "./styles.css";

const app = document.getElementById("app")!;
const audio = new AsmrAudioEngine();
const storage = new VaultStorageDB();
audio.muted = storage.data.muted;

type Route =
  | { name: "daily" }
  | { name: "wing"; wingId: string }
  | { name: "zen" };

let data: Dataset;
let route: Route = { name: "daily" };
let sequence: string[] = [];
let openedAt = 0;

const PALETTES = [
  { id: "midnight", name: "Midnight Velvet & Champagne Brass" },
  { id: "alabaster", name: "Sunlit Alabaster & Terracotta" },
  { id: "amethyst", name: "Twilight Amethyst & Rose Gold" },
  { id: "jade", name: "Botanical Jade & Warm Copper" },
];

function applyPalette() {
  document.body.dataset.palette = storage.data.palette;
}
applyPalette();

function sequenceFor(r: Route): { title: string; subtitle: string; ids: string[] } {
  switch (r.name) {
    case "daily":
      return {
        title: `Daily Grand Vault #${String(data.daily.number).padStart(3, "0")} — ${data.daily.date}`,
        subtitle: "Five chambers, one odyssey: warm up, deduce, brainstorm, and end at the Master Astrolabe. No timers — the light waits for you.",
        ids: data.daily.chambers,
      };
    case "wing": {
      const wing = data.wings.find((w) => w.id === r.wingId)!;
      return { title: `The Labyrinth — ${wing.title}`, subtitle: wing.theme, ids: wing.chambers };
    }
    case "zen":
      return {
        title: "Zen Muse Mode",
        subtitle: "Pure brainstorming and lateral light. No gears, no dials — only open keyholes.",
        ids: data.chambers.filter((c) => c.kind === "forge" || (c.kind === "venn" && c.brainstormSocket)).map((c) => c.id),
      };
  }
}

function headerHtml(): string {
  const p = storage.data;
  return `
    <header class="topbar">
      <button class="brand" data-nav="home" aria-label="Lumen Vault home">
        <svg viewBox="0 0 32 32" class="brand-mark" aria-hidden="true"><circle cx="16" cy="16" r="13" /><circle cx="16" cy="16" r="5" class="brand-dot" /></svg>
        <span>LUMEN&nbsp;VAULT</span>
      </button>
      <div class="top-stats">
        <span title="Insight Prisms">✦ ${p.prisms}</span>
        <span title="Wonder Artifacts">❖ ${p.artifacts.length}/${data.artifacts.length}</span>
        <span title="Lifetime score">Score ${p.totalScore.toLocaleString("en-US")}</span>
      </div>
      <div class="top-controls">
        <div class="palettes" role="group" aria-label="Palette">
          ${PALETTES.map((pl) => `<button class="swatch sw-${pl.id} ${storage.data.palette === pl.id ? "on" : ""}" data-palette="${pl.id}" title="${pl.name}" aria-label="${pl.name}"></button>`).join("")}
        </div>
        <button class="btn ghost small" id="sound-toggle">${p.muted ? "🔇 Sound off" : "🔊 Sound on"}</button>
      </div>
    </header>`;
}

function wireHeader() {
  app.querySelector("[data-nav='home']")?.addEventListener("click", renderHome);
  app.querySelectorAll<HTMLElement>("[data-palette]").forEach((b) =>
    b.addEventListener("click", () => {
      storage.data.palette = b.dataset.palette!;
      storage.save();
      applyPalette();
      wireHeaderSelection();
    })
  );
  app.querySelector("#sound-toggle")?.addEventListener("click", (ev) => {
    storage.data.muted = !storage.data.muted;
    storage.save();
    audio.setMuted(storage.data.muted);
    (ev.currentTarget as HTMLElement).textContent = storage.data.muted ? "🔇 Sound off" : "🔊 Sound on";
  });
}
function wireHeaderSelection() {
  app.querySelectorAll<HTMLElement>("[data-palette]").forEach((b) =>
    b.classList.toggle("on", b.dataset.palette === storage.data.palette)
  );
}

/* ------------------------------------------------------------------ */

function renderHome() {
  const dailyRun = storage.data.dailyRuns[data.daily.date];
  const dailyDone = dailyRun?.finished ? 5 : (dailyRun?.chambers.length ?? 0);
  const wings = data.wings
    .map((w) => {
      const solvedCount = w.chambers.filter((id) => storage.isSolved(id)).length;
      return `<button class="wing-btn" data-wing="${w.id}">
        <strong>${w.title}</strong>
        <span>${w.theme}</span>
        <em>${solvedCount}/${w.chambers.length} unsealed</em>
      </button>`;
    })
    .join("");
  app.innerHTML = `
    ${headerHtml()}
    <main class="home">
      <section class="hero glass">
        <h1>LUMEN VAULT</h1>
        <p class="tagline">A tactile puzzle-adventure in obsidian, glass and liquid brass.</p>
        <p class="hero-copy">Unlock a luminous constellation of Vault Chambers. Half of every lock is
        deduction — Venn intersections, chrono gears, elimination dials. The other half is
        <em>you</em>: open brainstorming under playful constraints. No timers. No fail screens.
        Only light, poured one chamber at a time.</p>
      </section>
      <section class="mode-grid">
        <article class="mode-card glass">
          <h2>✦ Daily Grand Vault</h2>
          <p>Today's five-chamber odyssey (#${String(data.daily.number).padStart(3, "0")}) — a warm-up Venn,
          a chrono chain, a resonance forge, a gilded intersection, and the Master Astrolabe.</p>
          <p class="mode-progress">${dailyDone}/5 chambers unsealed today</p>
          <button class="btn brass big" id="enter-daily">${dailyDone === 5 ? "Review today's vault" : "Enter the vault"}</button>
        </article>
        <article class="mode-card glass">
          <h2>❖ The Labyrinth</h2>
          <p>Endless thematic wings with persistent node-by-node progression.</p>
          <div class="wing-list">${wings}</div>
        </article>
        <article class="mode-card glass">
          <h2>✧ Zen Muse Mode</h2>
          <p>Untimed creative synthesis — resonance forges and open keyholes only.</p>
          <button class="btn brass big" id="enter-zen">Drift in</button>
          <button class="btn ghost" id="enter-cabinet">The Artifact Cabinet (${storage.data.artifacts.length}/${data.artifacts.length})</button>
        </article>
      </section>
      <section class="how glass">
        <h2>How the vault opens</h2>
        <ul>
          <li><strong>Venn Lock</strong> — drag vellum tiles into their exact set intersection; some chambers ask for one answer of your own.</li>
          <li><strong>Chrono Gearbox</strong> — deduce the true order of events from engraved relational clues until the teeth mesh.</li>
          <li><strong>Resonance Forge</strong> — brainstorm three answers that satisfy every glowing rune; rare answers spark brighter.</li>
          <li><strong>Deduction Astrolabe</strong> — flip logical filters to grey out the impossible until one artifact remains.</li>
          <li><strong>Insight Prisms</strong> — earned by flawless solves and rare brainstorms; spend one for a nudge that illuminates a single step, never the whole puzzle.</li>
        </ul>
      </section>
    </main>`;
  wireHeader();
  app.querySelector("#enter-daily")!.addEventListener("click", () => {
    route = { name: "daily" };
    renderMap();
  });
  app.querySelector("#enter-zen")!.addEventListener("click", () => {
    route = { name: "zen" };
    renderMap();
  });
  app.querySelector("#enter-cabinet")!.addEventListener("click", renderCabinet);
  app.querySelectorAll<HTMLElement>("[data-wing]").forEach((b) =>
    b.addEventListener("click", () => {
      route = { name: "wing", wingId: b.dataset.wing! };
      renderMap();
    })
  );
}

function renderMap() {
  const seq = sequenceFor(route);
  sequence = seq.ids;
  app.innerHTML = `
    ${headerHtml()}
    <main>
      <button class="btn ghost back-btn" id="back-home">← The Vault Door</button>
      <div id="map-root"></div>
    </main>`;
  wireHeader();
  app.querySelector("#back-home")!.addEventListener("click", renderHome);
  renderConstellationMap(app.querySelector("#map-root")!, {
    title: seq.title,
    subtitle: seq.subtitle,
    chamberIds: seq.ids,
    chamberById: data.chamberById,
    storage,
    onOpen: (chamberId) => openChamber(chamberId),
  });
}

function renderCabinet() {
  app.innerHTML = `
    ${headerHtml()}
    <main>
      <button class="btn ghost back-btn" id="back-home">← The Vault Door</button>
      <div id="cabinet-root"></div>
    </main>`;
  wireHeader();
  app.querySelector("#back-home")!.addEventListener("click", renderHome);
  renderArtifactCabinet(
    app.querySelector("#cabinet-root")!,
    data.artifacts,
    data.chamberById,
    new Set(storage.data.artifacts)
  );
}

/* ------------------------------------------------------------------ */

function openChamber(chamberId: string) {
  const spec = data.chamberById.get(chamberId)!;
  openedAt = performance.now();
  let nudges = 0;

  app.innerHTML = `
    ${headerHtml()}
    <main>
      <button class="btn ghost back-btn" id="back-map">← Constellation</button>
      <section class="chamber glass">
        <p class="chamber-kind">${kindLabel(spec.kind)} · ${storage.isSolved(chamberId) ? "Unsealed — replay for the love of it" : "Sealed"}</p>
        <h2>${spec.title}</h2>
        <p class="intro">${spec.intro}</p>
        <p class="chamber-meta">✦ Insight Prisms: <strong id="prism-count">${storage.data.prisms}</strong> · Nudges used: <strong id="nudge-count">0</strong></p>
        <p id="chamber-msg" class="msg" role="status"></p>
        <div id="chamber-body"></div>
      </section>
    </main>`;
  wireHeader();
  app.querySelector("#back-map")!.addEventListener("click", renderMap);

  const msgEl = app.querySelector<HTMLElement>("#chamber-msg")!;
  const host: ChamberHost = {
    audio,
    msg: (text, kind = "info") => {
      msgEl.textContent = text;
      msgEl.className = `msg ${kind}`;
    },
    hint: () => {
      if (!storage.spendPrism()) return false;
      nudges++;
      app.querySelector("#prism-count")!.textContent = String(storage.data.prisms);
      app.querySelector("#nudge-count")!.textContent = String(nudges);
      return true;
    },
    solve: (detail) => onSolve(spec, detail, nudges),
  };
  CHAMBER_RENDERERS[spec.kind](app.querySelector("#chamber-body")!, spec, data, host);
}

function kindLabel(kind: ChamberSpec["kind"]): string {
  return {
    venn: "Venn Lock",
    chrono: "Chrono-Causal Gearbox",
    forge: "Resonance Forge",
    astrolabe: "Deduction Astrolabe",
  }[kind];
}

function onSolve(spec: ChamberSpec, detail: SolveDetail, nudges: number) {
  const seconds = Math.max(1, Math.round((performance.now() - openedAt) / 1000));
  const wrong = detail.wrongPlacements;
  const score = chamberMastery(wrong, detail.brainstormTerms);
  const flawless = wrong === 0 && nudges === 0;
  const stars = Math.max(1, 3 - nudges - (wrong > 0 ? 1 : 0));
  const artifact = data.artifactByChamber.get(spec.id);
  const first = !storage.isSolved(spec.id);

  // Insight Prism economy (§2): +1 per flawless chamber, +1 per 2 rare brainstorms.
  const rareTerms = detail.brainstormTerms.filter(isRare).length;
  let prismsGained = 0;
  if (first) {
    if (flawless) prismsGained += 1;
    const before = storage.data.rareBrainstormCount;
    storage.addRareBrainstorms(rareTerms);
    prismsGained += Math.floor(storage.data.rareBrainstormCount / 2) - Math.floor(before / 2);
    if (prismsGained > 0) storage.addPrisms(prismsGained);
  }
  storage.recordSolve(spec.id, artifact?.id, first ? score : 0);

  // Daily run bookkeeping.
  let dailyFinished = false;
  if (route.name === "daily") {
    const key = data.daily.date;
    const run = storage.data.dailyRuns[key] ?? {
      date: key,
      number: data.daily.number,
      chambers: [],
      finished: false,
      totalScore: 0,
      prismsEarned: 0,
    };
    if (!run.chambers.some((c) => c.chamberId === spec.id)) {
      run.chambers.push({ chamberId: spec.id, stars, score, seconds });
      run.totalScore += score;
      run.prismsEarned += prismsGained;
    }
    run.finished = data.daily.chambers.every((id) => run.chambers.some((c) => c.chamberId === id));
    dailyFinished = run.finished;
    storage.data.dailyRuns[key] = run;
    storage.save();
  }

  audio.unsealChime();
  audio.goldPour();

  const breakdown = `
    <div class="score-lines">
      <p><span>Base solve</span><strong>500</strong></p>
      <p><span>Logic precision (${wrong} wrong placement${wrong === 1 ? "" : "s"})</span><strong>+${logicPrecisionBonus(wrong)}</strong></p>
      <p><span>Creative spark</span><strong>+${creativeSparkBonus(detail.brainstormTerms)}</strong></p>
      <p class="total"><span>Chamber mastery</span><strong>${score}</strong></p>
      <p class="stars-line">${"★".repeat(stars)}${"☆".repeat(3 - stars)} ${flawless ? "· Flawless" : ""}${prismsGained ? ` · +${prismsGained} Insight Prism${prismsGained > 1 ? "s" : ""}` : ""}</p>
    </div>`;

  const body = app.querySelector<HTMLElement>("#chamber-body")!;
  body.innerHTML = `
    <div class="unsealed">
      <div class="gold-burst" aria-hidden="true"></div>
      <h3>✦ Chamber unsealed</h3>
      <p class="unsealed-copy">Liquid gold pours along the conduit. The constellation brightens by one chamber.</p>
      ${breakdown}
      ${artifact ? `<div class="reward">${artifactCardHtml(artifact)}</div>` : ""}
      <div class="chamber-actions">
        ${dailyFinished ? `<button class="btn brass big" id="view-share">View today's constellation card</button>` : ""}
        <button class="btn brass big" id="back-map-2">Return to the constellation</button>
      </div>
    </div>`;
  const card = body.querySelector<HTMLElement>(".artifact-card");
  if (card) attachTilt(card);
  body.querySelector("#back-map-2")!.addEventListener("click", renderMap);
  body.querySelector("#view-share")?.addEventListener("click", renderDailyShare);
}

function renderDailyShare() {
  const run = storage.data.dailyRuns[data.daily.date]!;
  const results: ChamberResult[] = data.daily.chambers.map((id, i) => {
    const spec = data.chamberById.get(id)!;
    const rec = run.chambers.find((c) => c.chamberId === id);
    const artifact = data.artifactByChamber.get(id);
    return {
      kind: spec.kind,
      stars: rec?.stars ?? 0,
      note:
        rec && rec.stars === 3
          ? "Flawless"
          : artifact && spec.kind === "venn" && i === 4
            ? undefined
            : undefined,
      pathCode: pathCodeFor(spec),
    };
  });
  const card = renderShareCard({
    dailyNumber: run.number,
    cleared: run.chambers.length,
    total: data.daily.chambers.length,
    timeSeconds: run.chambers.reduce((s, c) => s + c.seconds, 0),
    score: run.totalScore,
    prisms: run.prismsEarned,
    chambers: results,
    goldRun: run.chambers.every((c) => c.stars === 3),
  });
  const body = app.querySelector<HTMLElement>("#chamber-body")!;
  body.innerHTML = `
    <div class="share-wrap">
      <h3>Today's Constellation Sharecard</h3>
      <pre class="share-card">${card}</pre>
      <div class="chamber-actions">
        <button class="btn brass" id="copy-share">Copy the card</button>
        <button class="btn ghost" id="back-map-3">Return to the constellation</button>
      </div>
    </div>`;
  body.querySelector("#back-map-3")!.addEventListener("click", renderMap);
  body.querySelector("#copy-share")!.addEventListener("click", async (ev) => {
    try {
      await navigator.clipboard.writeText(card);
      (ev.currentTarget as HTMLElement).textContent = "Copied ✦";
    } catch {
      (ev.currentTarget as HTMLElement).textContent = "Select the card and copy it by hand";
    }
  });
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
      return `A${spec.candidates.length % 10}`;
  }
}

/* ------------------------------------------------------------------ */

async function boot() {
  try {
    data = await loadDataset();
    renderHome();
  } catch (err) {
    app.innerHTML = `<main class="home"><section class="glass hero">
      <h1>LUMEN VAULT</h1>
      <p class="tagline">The vault's dataset could not be reached.</p>
      <p class="hero-copy">${err instanceof Error ? err.message : String(err)}</p>
    </section></main>`;
  }
}

void boot();
