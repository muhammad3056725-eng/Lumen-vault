/**
 * Chamber A — the Venn Lock. Every region of the diagram is a socket that
 * holds any number of tiles; each socket mirrors a ledger row beneath the
 * board (readable on phones, operable by keyboard). Three-ring chambers
 * may add a brainstorm socket: one typed answer that satisfies every ring.
 */
import type { Entity, VennChamberSpec } from "@lumen-vault/shared-types";
import { isRare, matchEntity, regionLabel, regionOf, satisfiesAllRings, validatePlacements } from "@lumen-vault/vault-engine";
import type { Dataset } from "../../data.js";
import { esc, shuffle } from "../../util.js";
import { Placement, type Zone } from "../placement.js";
import { nudge, tileHtml, type ChamberHost } from "./common.js";

const LETTERS = ["A", "B", "C"];

interface Layout {
  view: [number, number];
  circles: [number, number, number][];
  sockets: Record<number, [number, number]>;
  letters: [number, number][];
}

const LAYOUTS: Record<number, Layout> = {
  2: {
    view: [440, 300],
    circles: [
      [170, 150, 105],
      [270, 150, 105],
    ],
    sockets: { 1: [112, 150], 3: [220, 150], 2: [328, 150], 0: [404, 272] },
    letters: [
      [92, 62],
      [348, 62],
    ],
  },
  3: {
    view: [440, 340],
    circles: [
      [172, 128, 90],
      [268, 128, 90],
      [220, 208, 90],
    ],
    sockets: { 1: [118, 100], 3: [220, 74], 2: [322, 100], 7: [220, 150], 5: [160, 194], 6: [280, 194], 4: [220, 262], 0: [404, 314] },
    letters: [
      [98, 46],
      [342, 46],
      [220, 322],
    ],
  },
};

/** Ledger order: richest overlaps first, "outside" last. */
function regionOrder(n: number): number[] {
  const masks = Array.from({ length: 1 << n }, (_, i) => i);
  const bits = (m: number) => m.toString(2).split("1").length - 1;
  return masks.sort((a, b) => bits(b) - bits(a) || a - b).filter((m) => m !== 0).concat(0);
}

function chips(mask: number, n: number): string {
  return LETTERS.slice(0, n)
    .map((l, i) => `<span class="ring-chip r${i} ${mask & (1 << i) ? "in" : "out"}" aria-hidden="true">${l}</span>`)
    .join("");
}

export function renderVenn(root: HTMLElement, spec: VennChamberSpec, data: Dataset, host: ChamberHost) {
  const n = spec.rings.length;
  const layout = LAYOUTS[n];
  const [vw, vh] = layout.view;
  let wrongTotal = 0;
  let brainstormDone = !spec.brainstormSocket;
  const terms: Entity[] = [];
  const hinted = new Set<string>();
  const name = (id: string) => data.byId.get(id)!.canonical_title;

  const circles = layout.circles
    .map(([cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="venn-ring ring-${i}" />`)
    .join("");
  const ringRims = layout.circles
    .map(([cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="venn-rim rim-${i}" />`)
    .join("");
  const letters = layout.letters
    .map(([x, y], i) => `<g class="ring-letter r${i}"><circle cx="${x}" cy="${y}" r="15" /><text x="${x}" y="${y + 5}">${LETTERS[i]}</text></g>`)
    .join("");
  const sockets = Object.entries(layout.sockets)
    .map(([mask, [x, y]]) => {
      const label = regionLabel(Number(mask), spec.rings);
      return `<button type="button" class="socket" data-mask="${mask}" style="left:${(x / vw) * 100}%;top:${(y / vh) * 100}%" aria-label="Region: ${esc(label)}"><span class="socket-count">0</span></button>`;
    })
    .join("");
  const ledger = regionOrder(n)
    .map((mask) => {
      const label = regionLabel(mask, spec.rings);
      return `<div class="ledger-row" data-mask="${mask}" role="button" tabindex="0" aria-label="Region: ${esc(label)}">
        <div class="ledger-head">${chips(mask, n)}<span class="ledger-label">${esc(label)}</span></div>
        <div class="ledger-tiles" data-zone="${mask}"></div>
      </div>`;
    })
    .join("");
  const legend = spec.rings
    .map((r, i) => `<li class="legend-item r${i}"><span class="ring-chip r${i} in">${LETTERS[i]}</span>${esc(r.label)}</li>`)
    .join("");
  const tiles = shuffle(spec.tiles)
    .map((id) => tileHtml(id, esc(name(id)), esc(name(id))))
    .join("");

  root.innerHTML = `
    <div class="venn-layout">
      <div class="venn-stage">
        <ul class="ring-legend" aria-label="Rings">${legend}</ul>
        <div class="venn-board" style="aspect-ratio:${vw}/${vh}">
          <svg viewBox="0 0 ${vw} ${vh}" class="venn-svg" aria-hidden="true">${circles}${ringRims}${letters}</svg>
          ${sockets}
        </div>
      </div>
      <div class="venn-side">
        <div class="tray-wrap">
          <p class="tray-label">Vellum tray <span class="hint-text">— drag a tile onto the diagram or a row, or tap it, then tap where it belongs</span></p>
          <div class="tray" role="button" tabindex="0" aria-label="Vellum tray">${tiles}</div>
        </div>
        <div class="ledger" aria-label="Regions">${ledger}</div>
      </div>
    </div>
    ${
      spec.brainstormSocket
        ? `<div class="brainstorm-socket panel-lite">
             <p><span class="ring-chip-row">${chips((1 << n) - 1, n)}</span> The centre socket glows. Name <strong>any</strong> entry that sits in every ring at once:</p>
             <form class="brainstorm-form">
               <input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type a name…" aria-label="Brainstorm answer" />
               <button type="submit" class="btn brass">Turn the tumbler</button>
             </form>
           </div>`
        : ""
    }
    <div class="chamber-actions">
      <button type="button" class="btn brass big seal-btn">Seal the chamber</button>
      <button type="button" class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const tray = root.querySelector<HTMLElement>(".tray")!;
  const zones: Zone[] = [
    { key: "tray", label: "the tray", container: tray, hits: [tray], capacity: Infinity },
    ...regionOrder(n).map((mask) => ({
      key: String(mask),
      label: regionLabel(mask, spec.rings),
      container: root.querySelector<HTMLElement>(`.ledger-tiles[data-zone="${mask}"]`)!,
      hits: [root.querySelector<HTMLElement>(`.ledger-row[data-mask="${mask}"]`)!, root.querySelector<HTMLElement>(`.socket[data-mask="${mask}"]`)!],
      capacity: Infinity,
    })),
  ];
  const tileEls = [...root.querySelectorAll<HTMLElement>(".tile")];
  const refresh = () => {
    for (const z of zones) {
      if (z.key === "tray") continue;
      const count = z.container.querySelectorAll(".tile").length;
      const sock = root.querySelector<HTMLElement>(`.socket[data-mask="${z.key}"]`)!;
      sock.querySelector(".socket-count")!.textContent = String(count);
      sock.classList.toggle("filled", count > 0);
      z.hits[0].classList.toggle("filled", count > 0);
    }
    root.querySelector(".tray-wrap")!.classList.toggle("empty", tray.querySelectorAll(".tile").length === 0);
  };
  const placement = new Placement({
    tiles: tileEls,
    zones,
    audio: host.audio,
    onChange: refresh,
    announce: host.announce,
    nameOf: (t) => name(t.dataset.tile!),
  });
  refresh();

  const placements = () => {
    const map = new Map<string, number>();
    for (const t of tileEls) {
      const z = placement.zoneOf(t);
      if (z && z.key !== "tray") map.set(t.dataset.tile!, Number(z.key));
    }
    return map;
  };

  const form = root.querySelector<HTMLFormElement>(".brainstorm-form");
  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = form.querySelector("input")!;
    if (!input.value.trim()) return;
    const match = matchEntity(input.value, data.entities, (id) => satisfiesAllRings(data.byId.get(id)!, spec.rings));
    if (!match) {
      host.msg("The tumbler doesn't know that name yet — no harm done. Try another spelling, or another idea.", "info");
      return;
    }
    const entity = data.byId.get(match.entityId)!;
    if (!satisfiesAllRings(entity, spec.rings)) {
      host.msg(`${entity.canonical_title} is real, but it doesn't sit in every ring at once. The tumbler waits.`, "nudge");
      host.audio.nudge();
      return;
    }
    brainstormDone = true;
    terms.push(entity);
    form.closest(".brainstorm-socket")!.classList.add("satisfied");
    input.value = entity.canonical_title;
    input.disabled = true;
    form.querySelector("button")!.setAttribute("disabled", "");
    host.msg(`${entity.canonical_title} turns the final tumbler with a warm click.${isRare(entity) ? " A rare spark, too." : ""}`, "good");
    host.audio.brassClick();
  });

  root.querySelector(".seal-btn")!.addEventListener("click", () => {
    const placed = placements();
    if (placed.size < spec.tiles.length) {
      host.msg("Some tiles still rest on the tray — every tile has a home in the diagram.", "nudge");
      host.audio.nudge();
      return;
    }
    const v = validatePlacements(spec, data.byId, placed);
    if (!v.allCorrect) {
      wrongTotal += v.wrongCount;
      for (const [tileId, ok] of Object.entries(v.perTile)) {
        if (ok) continue;
        const tile = tileEls.find((t) => t.dataset.tile === tileId)!;
        placement.place(tile, "tray");
      }
      host.msg(`${v.wrongCount} tile${v.wrongCount > 1 ? "s glide" : " glides"} back to the tray. Rethink what each ring truly claims.`, "nudge");
      host.audio.nudge();
      return;
    }
    if (!brainstormDone) {
      host.msg("Every tile is true — but the centre socket still glows. The chamber wants one answer of your own.", "nudge");
      root.querySelector<HTMLInputElement>(".brainstorm-form input")?.focus();
      return;
    }
    host.solve({ wrongPlacements: wrongTotal, brainstormTerms: terms });
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    const placed = placements();
    const target = spec.tiles.find((id) => placed.get(id) !== regionOf(data.byId.get(id)!, spec.rings));
    nudge(
      host,
      () => (target ? null : spec.brainstormSocket && !brainstormDone ? "The tiles are all true. The prism saves itself for your own answer." : "The prism finds nothing out of place. Seal the chamber."),
      () => {
        const id = target!;
        const mask = regionOf(data.byId.get(id)!, spec.rings);
        if (hinted.has(id)) {
          const tile = tileEls.find((t) => t.dataset.tile === id)!;
          placement.place(tile, String(mask));
          host.msg(`The prism gently sets ${name(id)} where it belongs.`, "good");
        } else {
          hinted.add(id);
          const sock = root.querySelector<HTMLElement>(`.socket[data-mask="${mask}"]`)!;
          const row = root.querySelector<HTMLElement>(`.ledger-row[data-mask="${mask}"]`)!;
          [sock, row].forEach((el) => {
            el.classList.add("hint-glow");
            setTimeout(() => el.classList.remove("hint-glow"), 2600);
          });
          host.msg(`Nudge: ${name(id)} belongs ${mask === 0 ? "outside every ring" : `in ${regionLabel(mask, spec.rings)}`}. (Ask again and the prism will place it.)`, "info");
        }
      }
    );
  });
}
