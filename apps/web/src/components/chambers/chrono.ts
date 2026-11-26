/**
 * Chamber B — the Chrono-Causal Gearbox. Gear slots hold one event each;
 * dropping onto an occupied slot swaps. The plaques are relational and
 * pin down exactly one order (proved at build time), so the chain can be
 * deduced without knowing a single date.
 */
import type { ChronoChamberSpec } from "@lumen-vault/shared-types";
import { clueText, solveChrono, validateArrangement } from "@lumen-vault/vault-engine";
import type { Dataset } from "../../data.js";
import { esc, fmtYear, shuffle } from "../../util.js";
import { Placement, type Zone } from "../placement.js";
import { nudge, tileHtml, type ChamberHost } from "./common.js";

const GEAR_PATH =
  "M50 6 L55 18 A32 32 0 0 1 68 24 L80 18 L84 28 L74 36 A32 32 0 0 1 76 50 L90 54 L88 65 L76 64 A32 32 0 0 1 68 76 L74 88 L64 92 L58 81 A32 32 0 0 1 42 81 L36 92 L26 88 L32 76 A32 32 0 0 1 24 64 L10 65 L12 54 L24 50 A32 32 0 0 1 26 36 L16 28 L20 18 L32 24 A32 32 0 0 1 45 18 Z";

export function gearSvg(cls = ""): string {
  return `<svg viewBox="0 0 100 100" class="gear ${cls}" aria-hidden="true"><path d="${GEAR_PATH}" fill="url(#lv-brass)" class="gear-body"/><path d="${GEAR_PATH}" fill="url(#lv-spec)" opacity="0.5"/><circle cx="50" cy="50" r="13" class="gear-hub"/><circle cx="50" cy="50" r="5" class="gear-pin"/></svg>`;
}

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];

export function renderChrono(root: HTMLElement, spec: ChronoChamberSpec, data: Dataset, host: ChamberHost) {
  const solution = solveChrono(spec, data.byId);
  const name = (id: string) => data.byId.get(id)!.canonical_title;
  let wrongTotal = 0;
  const revealed = new Set<string>();

  const slots = spec.gears
    .map(
      (_, i) => `
      <li class="gear-slot" data-slot="${i}" role="button" tabindex="0" aria-label="Gear position ${i + 1} of ${spec.gears.length}">
        <div class="gear-mount">${gearSvg(i % 2 ? "rev" : "")}<span class="gear-num">${ORDINAL[i]}</span></div>
        <div class="slot-tiles" data-zone="slot-${i}"></div>
      </li>`
    )
    .join("");
  const tiles = shuffle(spec.gears)
    .map((id) => tileHtml(id, `${esc(name(id))}<span class="tile-year" data-year-for="${id}"></span>`, esc(name(id)), "gear-tile"))
    .join("");
  const clues = spec.clues.map((c, i) => `<li><span class="plaque-num">${i + 1}</span>${esc(clueText(c, name))}</li>`).join("");

  root.innerHTML = `
    <div class="chrono-layout">
      <div class="chrono-train-wrap">
        <p class="axis"><span>earliest</span><span class="axis-line" aria-hidden="true"></span><span>latest</span></p>
        <ol class="gear-train">${slots}</ol>
      </div>
      <div class="chrono-side">
        <div class="tray-wrap">
          <p class="tray-label">Event tray <span class="hint-text">— drag or tap a gear-tile, then a slot</span></p>
          <div class="tray" role="button" tabindex="0" aria-label="Event tray">${tiles}</div>
        </div>
        <div class="plaques panel-lite"><h3>Engraved plaques</h3><ol>${clues}</ol>
          <p class="plaque-note">The plaques alone fix one order — no dates needed.</p></div>
      </div>
    </div>
    <div class="chamber-actions">
      <button type="button" class="btn brass big seal-btn">Mesh the gears</button>
      <button type="button" class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const tray = root.querySelector<HTMLElement>(".tray")!;
  const slotEls = [...root.querySelectorAll<HTMLElement>(".gear-slot")];
  const zones: Zone[] = [
    { key: "tray", label: "the tray", container: tray, hits: [tray], capacity: Infinity },
    ...slotEls.map((s, i) => ({
      key: `slot-${i}`,
      label: `gear position ${i + 1}`,
      container: s.querySelector<HTMLElement>(".slot-tiles")!,
      hits: [s],
      capacity: 1,
    })),
  ];
  const tileEls = [...root.querySelectorAll<HTMLElement>(".tile")];
  const arrangement = () => slotEls.map((s) => s.querySelector<HTMLElement>(".tile")?.dataset.tile ?? null);
  const refresh = () => {
    slotEls.forEach((s) => s.classList.toggle("filled", !!s.querySelector(".tile")));
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

  root.querySelector(".seal-btn")!.addEventListener("click", () => {
    const arr = arrangement();
    if (arr.some((x) => x === null)) {
      host.msg("A gear stands empty — every event must take its place in the chain.", "nudge");
      host.audio.nudge();
      return;
    }
    const v = validateArrangement(solution, arr);
    if (!v.correct) {
      wrongTotal += v.misplacedCount;
      arr.forEach((id, i) => {
        if (solution.order[i] !== id) placement.place(tileEls.find((t) => t.dataset.tile === id)!, "tray");
      });
      host.msg(`The teeth grind softly — ${v.misplacedCount} gear${v.misplacedCount > 1 ? "s sit" : " sits"} out of time. The plaques know the way.`, "nudge");
      host.audio.nudge();
      return;
    }
    root.querySelector(".gear-train")!.classList.add("meshed");
    for (const id of spec.gears) {
      const y = root.querySelector<HTMLElement>(`[data-year-for="${id}"]`);
      if (y) y.textContent = ` · ${fmtYear(data.byId.get(id)!.era_year)}`;
    }
    host.solve({ wrongPlacements: wrongTotal, brainstormTerms: [] });
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    const arr = arrangement();
    const wrongIdx = solution.order.findIndex((id, i) => arr[i] !== id);
    nudge(
      host,
      () => (wrongIdx === -1 ? "The prism finds the chain already true. Mesh the gears." : null),
      () => {
        const targetId = solution.order[wrongIdx];
        if (!revealed.has(targetId)) {
          revealed.add(targetId);
          const y = root.querySelector<HTMLElement>(`[data-year-for="${targetId}"]`);
          if (y) y.textContent = ` · ${fmtYear(data.byId.get(targetId)!.era_year)}`;
          slotEls[wrongIdx].classList.add("hint-glow");
          setTimeout(() => slotEls[wrongIdx].classList.remove("hint-glow"), 2600);
          host.msg(`Nudge: ${name(targetId)} (${fmtYear(data.byId.get(targetId)!.era_year)}) belongs in the ${ORDINAL[wrongIdx]} position. Ask again and the prism will seat it.`, "info");
        } else {
          placement.place(tileEls.find((t) => t.dataset.tile === targetId)!, `slot-${wrongIdx}`);
          host.msg(`The prism seats ${name(targetId)} into its true gear.`, "good");
        }
      }
    );
  });
}
