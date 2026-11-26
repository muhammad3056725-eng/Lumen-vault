/**
 * The four Vault Chamber renderers (Blueprint §2):
 *  A. VennLockChamber      — set-intersection drag + brainstorm socket
 *  B. ChronoGearChamber    — chronological gear ordering
 *  C. ResonanceForgeChamber— constraint brainstorming
 *  D. AstrolabeChamber     — elimination dial
 * All validation runs client-side through @lumen-vault/vault-engine
 * (H2). Misplacements glide back on the vault spring with a kind
 * nudge — there are no fail screens (§1).
 */
import type {
  AstrolabeChamberSpec,
  ChamberSpec,
  ChronoChamberSpec,
  Entity,
  ForgeChamberSpec,
  VennChamberSpec,
} from "@lumen-vault/shared-types";
import {
  applyFilters,
  chamberMastery,
  clueText,
  evaluateForgeAnswer,
  forgePool,
  isRare,
  matchEntity,
  regionLabel,
  regionOf,
  satisfiesAllRings,
  solveChrono,
  validateArrangement,
  validatePlacements,
} from "@lumen-vault/vault-engine";
import type { Dataset } from "../data.js";
import type { AsmrAudioEngine } from "../engine/AsmrAudioEngine.js";
import { attachDrag } from "./drag.js";

export interface SolveDetail {
  wrongPlacements: number;
  brainstormTerms: Entity[];
  autoFilled: number;
}

export interface ChamberHost {
  msg(text: string, kind?: "info" | "nudge" | "good"): void;
  /** Spend one Insight Prism for a nudge (M4). False when none left. */
  hint(): boolean;
  solve(detail: SolveDetail): void;
  audio: AsmrAudioEngine;
}

export type ChamberRenderer = (
  root: HTMLElement,
  spec: ChamberSpec,
  data: Dataset,
  host: ChamberHost
) => void;

const el = (html: string): HTMLElement => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------------------------------------------------ */
/* A. The Venn Lock                                                    */
/* ------------------------------------------------------------------ */

const VENN_LAYOUTS: Record<number, { circles: [number, number, number][]; sockets: Record<number, [number, number]> }> = {
  2: {
    circles: [
      [168, 140, 94],
      [272, 140, 94],
    ],
    sockets: { 0: [220, 302], 1: [102, 140], 2: [338, 140], 3: [220, 140] },
  },
  3: {
    circles: [
      [172, 128, 90],
      [268, 128, 90],
      [220, 198, 90],
    ],
    sockets: {
      0: [402, 308],
      1: [110, 80],
      2: [330, 80],
      3: [220, 62],
      4: [220, 284],
      5: [146, 216],
      6: [294, 216],
      7: [220, 148],
    },
  },
};

function renderVenn(root: HTMLElement, spec: VennChamberSpec, data: Dataset, host: ChamberHost) {
  const layout = VENN_LAYOUTS[spec.rings.length];
  const placements = new Map<string, number>();
  let wrongTotal = 0;
  let hintLevel = 0;
  let brainstormDone = !spec.brainstormSocket;
  const terms: Entity[] = [];

  const circles = layout.circles
    .map(([cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="venn-ring ring-${i}" />`)
    .join("");
  const ringLabels = layout.circles
    .map(([cx, cy], i) => {
      const y = spec.rings.length === 2 ? cy - 108 : i === 2 ? cy + 118 : cy - 104;
      const x = spec.rings.length === 3 && i === 2 ? 220 : cx;
      return `<text x="${x}" y="${y}" class="venn-ring-label">${spec.rings[i].label}</text>`;
    })
    .join("");
  const sockets = Object.entries(layout.sockets)
    .map(
      ([mask, [x, y]]) =>
        `<div class="socket" data-mask="${mask}" style="left:${(x / 440) * 100}%;top:${(y / 340) * 100}%" aria-label="socket ${mask}"></div>`
    )
    .join("");
  const tiles = shuffle(spec.tiles)
    .map((id) => `<div class="tile vellum" data-tile="${id}">${data.byId.get(id)!.canonical_title}</div>`)
    .join("");

  root.innerHTML = `
    <div class="venn-board">
      <svg viewBox="0 0 440 340" class="venn-svg" aria-hidden="true">${circles}${ringLabels}</svg>
      ${sockets}
    </div>
    <div class="tray" aria-label="Vellum tiles">${tiles}</div>
    ${
      spec.brainstormSocket
        ? `<div class="brainstorm-socket glass-lite">
             <p>✦ The centre socket glows. Name <strong>any real work</strong> that satisfies every ring at once:</p>
             <form class="brainstorm-form">
               <input type="text" autocomplete="off" placeholder="Type a title…" aria-label="Brainstorm answer" />
               <button type="submit" class="btn brass">Turn the tumbler</button>
             </form>
           </div>`
        : ""
    }
    <div class="chamber-actions">
      <button class="btn brass big seal-btn">Seal the chamber</button>
      <button class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const tray = root.querySelector<HTMLElement>(".tray")!;
  const socketEls = [...root.querySelectorAll<HTMLElement>(".socket")];
  const socketFor = (mask: number) => socketEls.find((s) => s.dataset.mask === String(mask))!;

  root.querySelectorAll<HTMLElement>(".tile").forEach((tile) => {
    const tileId = tile.dataset.tile!;
    attachDrag(tile, {
      audio: host.audio,
      targets: () =>
        socketEls.map((s) => ({
          el: s,
          key: s.dataset.mask!,
          occupied: () => s.querySelector(".tile") !== null && s.querySelector(".tile") !== tile,
        })),
      onSnap: (key) => placements.set(tileId, Number(key)),
      onUnsnap: () => {
        if (tile.parentElement === tray) placements.delete(tileId);
      },
    });
  });

  const form = root.querySelector<HTMLFormElement>(".brainstorm-form");
  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = form.querySelector("input")!;
    const match = matchEntity(input.value, data.entities);
    if (!match) {
      host.msg("The tumbler doesn't recognise that title — check the spelling, or think of another.", "nudge");
      host.audio.nudge();
      return;
    }
    const entity = data.byId.get(match.entityId)!;
    if (!satisfiesAllRings(entity, spec.rings)) {
      host.msg(`${entity.canonical_title} is real, but it doesn't satisfy every ring at once. The tumbler stays still.`, "nudge");
      host.audio.nudge();
      return;
    }
    brainstormDone = true;
    terms.push(entity);
    form.closest(".brainstorm-socket")!.classList.add("satisfied");
    input.disabled = true;
    host.msg(`${entity.canonical_title} turns the final tumbler with a warm click.${isRare(entity) ? " A rare spark, too." : ""}`, "good");
    host.audio.brassClick();
  });

  root.querySelector(".seal-btn")!.addEventListener("click", () => {
    if (placements.size < spec.tiles.length) {
      host.msg("Some tiles still rest on the tray — every tile has a home in the diagram.", "nudge");
      host.audio.nudge();
      return;
    }
    const v = validatePlacements(spec, data.byId, placements);
    if (!v.allCorrect) {
      wrongTotal += v.wrongCount;
      for (const [tileId, ok] of Object.entries(v.perTile)) {
        if (ok) continue;
        const tile = root.querySelector<HTMLElement>(`[data-tile="${tileId}"]`)!;
        tray.appendChild(tile);
        placements.delete(tileId);
      }
      host.msg(
        `${v.wrongCount} tile${v.wrongCount > 1 ? "s glide" : " glides"} back to the tray. Rethink what each ring truly claims.`,
        "nudge"
      );
      host.audio.nudge();
      return;
    }
    if (!brainstormDone) {
      host.msg("Every tile is true — but the centre socket still glows. The chamber wants one answer of your own.", "nudge");
      return;
    }
    host.solve({ wrongPlacements: wrongTotal, brainstormTerms: terms, autoFilled: 0 });
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    if (!host.hint()) {
      host.msg("Your prism pouch is empty — flawless solves and rare brainstorms refill it.", "nudge");
      return;
    }
    hintLevel++;
    const wrongTileId = spec.tiles.find((id) => {
      const e = data.byId.get(id)!;
      return placements.get(id) !== regionOf(e, spec.rings);
    });
    if (!wrongTileId) {
      host.msg("The prism finds nothing out of place. Trust your arrangement.", "good");
      return;
    }
    const entity = data.byId.get(wrongTileId)!;
    const trueMask = regionOf(entity, spec.rings);
    if (hintLevel >= 3) {
      const tile = root.querySelector<HTMLElement>(`[data-tile="${wrongTileId}"]`)!;
      socketFor(trueMask).appendChild(tile);
      placements.set(wrongTileId, trueMask);
      host.msg(`The prism gently sets ${entity.canonical_title} where it belongs.`, "good");
      host.audio.brassClick();
    } else {
      socketFor(trueMask).classList.add("hint-glow");
      setTimeout(() => socketFor(trueMask).classList.remove("hint-glow"), 2400);
      host.msg(`Nudge: ${entity.canonical_title} belongs where ${regionLabel(trueMask, spec.rings)}.`, "info");
    }
  });
}

/* ------------------------------------------------------------------ */
/* B. The Chrono-Causal Gearbox                                       */
/* ------------------------------------------------------------------ */

function renderChrono(root: HTMLElement, spec: ChronoChamberSpec, data: Dataset, host: ChamberHost) {
  const solution = solveChrono(spec, data.byId);
  const gearEntities = spec.gears.map((id) => data.byId.get(id)!);
  let wrongTotal = 0;
  let hintLevel = 0;

  const slots = spec.gears
    .map(
      (_, i) => `
      <div class="gear-slot" data-slot="${i}">
        <svg viewBox="0 0 100 100" class="gear ${i % 2 ? "gear-rev" : ""}" aria-hidden="true">
          <path d="M50 6 L55 18 A32 32 0 0 1 68 24 L80 18 L84 28 L74 36 A32 32 0 0 1 76 50 L90 54 L88 65 L76 64 A32 32 0 0 1 68 76 L74 88 L64 92 L58 81 A32 32 0 0 1 42 81 L36 92 L26 88 L32 76 A32 32 0 0 1 24 64 L10 65 L12 54 L24 50 A32 32 0 0 1 26 36 L16 28 L20 18 L32 24 A32 32 0 0 1 45 18 Z" />
          <circle cx="50" cy="50" r="11" />
        </svg>
        <span class="gear-num">${i + 1}</span>
      </div>`
    )
    .join("");
  const tiles = shuffle(spec.gears)
    .map((id) => `<div class="tile vellum gear-tile" data-tile="${id}">${data.byId.get(id)!.canonical_title}</div>`)
    .join("");
  const clues = spec.clues.map((c) => `<li>${clueText(c, gearEntities)}</li>`).join("");

  root.innerHTML = `
    <div class="gear-row">${slots}</div>
    <div class="tray">${tiles}</div>
    <div class="clues glass-lite"><h3>Engraved plaques</h3><ul>${clues}</ul></div>
    <div class="chamber-actions">
      <button class="btn brass big seal-btn">Mesh the gears</button>
      <button class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const tray = root.querySelector<HTMLElement>(".tray")!;
  const slotEls = [...root.querySelectorAll<HTMLElement>(".gear-slot")];
  const arrangement = (): (string | null)[] =>
    slotEls.map((s) => s.querySelector<HTMLElement>(".tile")?.dataset.tile ?? null);

  root.querySelectorAll<HTMLElement>(".tile").forEach((tile) => {
    attachDrag(tile, {
      audio: host.audio,
      targets: () =>
        slotEls.map((s) => ({
          el: s,
          key: s.dataset.slot!,
          occupied: () => s.querySelector(".tile") !== null && s.querySelector(".tile") !== tile,
        })),
      onSnap: () => {},
      onUnsnap: () => {},
    });
  });

  root.querySelector(".seal-btn")!.addEventListener("click", () => {
    const arr = arrangement();
    if (arr.some((x) => x === null)) {
      host.msg("A gear stands empty — every event must take its place in the chain.", "nudge");
      host.audio.nudge();
      return;
    }
    const v = validateArrangement(solution, arr as string[]);
    if (!v.correct) {
      wrongTotal += v.misplacedCount;
      (arr as string[]).forEach((tileId, i) => {
        if (solution.order[i] !== tileId) {
          const tile = root.querySelector<HTMLElement>(`[data-tile="${tileId}"]`)!;
          tray.appendChild(tile);
        }
      });
      host.msg(`The teeth grind softly — ${v.misplacedCount} gear${v.misplacedCount > 1 ? "s sit" : " sits"} out of time. The plaques know the way.`, "nudge");
      host.audio.nudge();
      return;
    }
    host.solve({ wrongPlacements: wrongTotal, brainstormTerms: [], autoFilled: 0 });
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    if (!host.hint()) {
      host.msg("Your prism pouch is empty — flawless solves and rare brainstorms refill it.", "nudge");
      return;
    }
    hintLevel++;
    const arr = arrangement();
    const wrongIdx = solution.order.findIndex((id, i) => arr[i] !== id);
    if (wrongIdx === -1) {
      host.msg("The prism finds the chain already true. Mesh the gears.", "good");
      return;
    }
    const targetId = solution.order[wrongIdx];
    const entity = data.byId.get(targetId)!;
    if (hintLevel === 1) {
      host.msg(`Nudge: ${entity.canonical_title} — ${entity.era_year}. Anchor your chain around it.`, "info");
    } else if (hintLevel === 2) {
      slotEls[wrongIdx].classList.add("hint-glow");
      setTimeout(() => slotEls[wrongIdx].classList.remove("hint-glow"), 2400);
      host.msg(`Nudge: ${entity.canonical_title} belongs in gear position ${wrongIdx + 1}.`, "info");
    } else {
      const tile = root.querySelector<HTMLElement>(`[data-tile="${targetId}"]`)!;
      const currentSlot = slotEls.find((s) => s.contains(tile));
      if (currentSlot && currentSlot !== slotEls[wrongIdx]) currentSlot.querySelector(".tile") && tray.appendChild(currentSlot.querySelector(".tile")!);
      const occupant = slotEls[wrongIdx].querySelector<HTMLElement>(".tile");
      if (occupant) tray.appendChild(occupant);
      slotEls[wrongIdx].appendChild(tile);
      host.msg(`The prism seats ${entity.canonical_title} into its true gear.`, "good");
      host.audio.brassClick();
    }
  });
}

/* ------------------------------------------------------------------ */
/* C. The Resonance Forge                                              */
/* ------------------------------------------------------------------ */

function renderForge(root: HTMLElement, spec: ForgeChamberSpec, data: Dataset, host: ChamberHost) {
  const used = new Set<string>();
  const terms: Entity[] = [];
  let wrongTotal = 0;
  let hintLevel = 0;
  let autoFilled = 0;

  const runes = spec.constraints.map((c) => `<span class="rune">✧ ${c.label}</span>`).join("");
  root.innerHTML = `
    <div class="forge-stage">
      <svg viewBox="0 0 200 190" class="prism-svg" aria-hidden="true">
        <defs>
          <clipPath id="prism-clip"><path d="M100 12 L172 168 L28 168 Z" /></clipPath>
          <linearGradient id="goldfill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#E5C17B" /><stop offset="1" stop-color="#FFF3D6" />
          </linearGradient>
        </defs>
        <g clip-path="url(#prism-clip)">
          <rect class="prism-fill" x="0" y="190" width="200" height="190" fill="url(#goldfill)" opacity="0.9" />
        </g>
        <path d="M100 12 L172 168 L28 168 Z" class="prism-outline" />
        <path d="M100 12 L100 168 M100 84 L136 168 M100 84 L64 168" class="prism-facet" />
      </svg>
      <div class="runes">${runes}</div>
    </div>
    <form class="forge-form">
      <input type="text" autocomplete="off" placeholder="Offer an answer…" aria-label="Forge answer" />
      <button type="submit" class="btn brass">Offer</button>
    </form>
    <p class="forge-count">The prism has drunk <strong class="drunk">0</strong> of ${spec.answersNeeded} lights.</p>
    <ul class="forge-answers"></ul>
    <div class="chamber-actions">
      <button class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const fill = root.querySelector<SVGRectElement>(".prism-fill")!;
  const drunk = root.querySelector(".drunk")!;
  const list = root.querySelector(".forge-answers")!;
  const setFill = () => {
    const ratio = used.size / spec.answersNeeded;
    fill.setAttribute("y", String(190 - 178 * ratio));
    drunk.textContent = String(used.size);
  };

  const accept = (entity: Entity, countSpark: boolean) => {
    used.add(entity.entity_id);
    if (countSpark) terms.push(entity);
    const li = document.createElement("li");
    li.textContent = `✦ ${entity.canonical_title}${isRare(entity) && countSpark ? " — a rare spark" : ""}`;
    list.appendChild(li);
    setFill();
    host.audio.goldPour();
    if (used.size >= spec.answersNeeded) {
      host.solve({ wrongPlacements: wrongTotal, brainstormTerms: terms, autoFilled });
    }
  };

  root.querySelector<HTMLFormElement>(".forge-form")!.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = root.querySelector<HTMLInputElement>(".forge-form input")!;
    const result = evaluateForgeAnswer(input.value, spec, data.entities, used);
    if (!result.accepted || !result.entity) {
      if (!result.duplicate) wrongTotal++;
      host.msg(result.reason, "nudge");
      host.audio.nudge();
      return;
    }
    input.value = "";
    host.msg(result.reason, "good");
    accept(result.entity, true);
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    if (!host.hint()) {
      host.msg("Your prism pouch is empty — flawless solves and rare brainstorms refill it.", "nudge");
      return;
    }
    hintLevel++;
    const pool = forgePool(spec, data.entities).filter((e) => !used.has(e.entity_id));
    if (pool.length === 0) {
      host.msg("The prism is already full of light.", "good");
      return;
    }
    const pick = pool[0];
    if (hintLevel === 1) {
      const domain = spec.constraints.find((c) => c.type === "DOMAIN");
      host.msg(`Nudge: think of ${domain ? domain.label.toLowerCase() : "an answer"} whose name starts with “${pick.canonical_title.replace(/^(The|A|An)\s+/i, "").charAt(0)}”.`, "info");
    } else if (hintLevel === 2) {
      const name = pick.canonical_title;
      host.msg(`Nudge: the prism dreams of “${name.charAt(0)}…${name.charAt(name.length - 1)}” — ${name.length} letters of light.`, "info");
    } else {
      autoFilled++;
      host.msg(`The prism pours ${pick.canonical_title} in by itself — no spark, but the light is real.`, "good");
      accept(pick, false);
    }
  });
}

/* ------------------------------------------------------------------ */
/* D. The Deduction Astrolabe                                          */
/* ------------------------------------------------------------------ */

function renderAstrolabe(root: HTMLElement, spec: AstrolabeChamberSpec, data: Dataset, host: ChamberHost) {
  const active = new Set<number>();
  const eliminated = new Set<string>();
  let wrongTotal = 0;
  let hintLevel = 0;

  const filters = spec.filters
    .map((f, i) => `<button class="filter-switch" data-filter="${i}" aria-pressed="false">◌ ${f.label}</button>`)
    .join("");
  const sectors = spec.candidates
    .map((id, i) => {
      const angle = (i / spec.candidates.length) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + 39 * Math.cos(angle);
      const y = 50 + 39 * Math.sin(angle);
      return `<button class="sector" data-id="${id}" style="left:${x}%;top:${y}%">${data.byId.get(id)!.canonical_title}</button>`;
    })
    .join("");

  root.innerHTML = `
    <div class="astrolabe-board">
      <div class="astrolabe-ring"></div>
      ${sectors}
      <div class="lens"><span class="lens-mark">?</span><span class="lens-sub">the hidden artifact</span></div>
    </div>
    <div class="filters">${filters}</div>
    <p class="astro-note">Flip the filters to grey out the impossible — then tap the one artifact that remains in the light.</p>
    <div class="chamber-actions">
      <button class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const sectorEls = [...root.querySelectorAll<HTMLElement>(".sector")];
  const refresh = () => {
    const remaining = new Set(applyFilters(spec, data.byId, active));
    sectorEls.forEach((s) => {
      const id = s.dataset.id!;
      s.classList.toggle("greyed", !remaining.has(id) || eliminated.has(id));
      s.toggleAttribute("disabled", !remaining.has(id) || eliminated.has(id));
    });
  };
  refresh();

  root.querySelectorAll<HTMLElement>(".filter-switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.filter);
      if (active.has(i)) {
        active.delete(i);
        btn.classList.remove("on");
        btn.setAttribute("aria-pressed", "false");
        btn.textContent = `◌ ${spec.filters[i].label}`;
      } else {
        active.add(i);
        btn.classList.add("on");
        btn.setAttribute("aria-pressed", "true");
        btn.textContent = `● ${spec.filters[i].label}`;
        host.audio.brassClick();
      }
      refresh();
    });
  });

  sectorEls.forEach((s) => {
    s.addEventListener("click", () => {
      const id = s.dataset.id!;
      if (id === spec.answer) {
        root.querySelector(".lens-mark")!.textContent = "✦";
        host.solve({ wrongPlacements: wrongTotal, brainstormTerms: [], autoFilled: 0 });
      } else {
        wrongTotal++;
        eliminated.add(id);
        refresh();
        host.msg(`The lens clouds over ${data.byId.get(id)!.canonical_title} — a beautiful guess, but not the artifact.`, "nudge");
        host.audio.nudge();
      }
    });
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    if (!host.hint()) {
      host.msg("Your prism pouch is empty — flawless solves and rare brainstorms refill it.", "nudge");
      return;
    }
    hintLevel++;
    const inactive = spec.filters.map((_, i) => i).filter((i) => !active.has(i));
    if (inactive.length === 0) {
      host.msg("Every filter already turns. Only one light can remain — tap it.", "good");
      return;
    }
    if (hintLevel === 1) {
      const btn = root.querySelector<HTMLElement>(`[data-filter="${inactive[0]}"]`)!;
      btn.classList.add("hint-glow");
      setTimeout(() => btn.classList.remove("hint-glow"), 2400);
      host.msg(`Nudge: the prism leans toward the filter “${spec.filters[inactive[0]].label}”.`, "info");
    } else {
      const btn = root.querySelector<HTMLElement>(`[data-filter="${inactive[0]}"]`)!;
      btn.click();
      host.msg("The prism flips the switch for you. Watch the impossible fade.", "good");
    }
  });
}

export const CHAMBER_RENDERERS: Record<ChamberSpec["kind"], ChamberRenderer> = {
  venn: (root, spec, data, host) => renderVenn(root, spec as VennChamberSpec, data, host),
  chrono: (root, spec, data, host) => renderChrono(root, spec as ChronoChamberSpec, data, host),
  forge: (root, spec, data, host) => renderForge(root, spec as ForgeChamberSpec, data, host),
  astrolabe: (root, spec, data, host) => renderAstrolabe(root, spec as AstrolabeChamberSpec, data, host),
};

export { chamberMastery };
