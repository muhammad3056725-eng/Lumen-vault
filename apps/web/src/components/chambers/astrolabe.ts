/**
 * Chamber D — the Deduction Astrolabe. Names only on the dial; riddle
 * plaques describe the hidden artifact. Tap names to cloud the ones a
 * riddle rules out (free, reversible), then focus the lens on the one
 * that remains. Attributes are revealed only after the lens is focused.
 */
import type { AstrolabeChamberSpec } from "@lumen-vault/shared-types";
import { DOMAIN_NAME, ERA_NAME, REGION_NAME, attributeOf, firstBrokenClue } from "@lumen-vault/vault-engine";
import type { Dataset } from "../../data.js";
import { esc, fmtYear } from "../../util.js";
import { nudge, type ChamberHost } from "./common.js";

const CREATOR_SHORT: Record<string, string> = {
  SOLO: "one maker",
  DUO: "a pair",
  TEAM: "a team",
  TEAM_GOVERNMENT_AGENCY: "a government agency",
  NATURE: "nature",
  TRADITIONAL: "tradition",
};

export function renderAstrolabe(root: HTMLElement, spec: AstrolabeChamberSpec, data: Dataset, host: ChamberHost) {
  const clouded = new Set<string>();
  let wrongTotal = 0;
  const name = (id: string) => data.byId.get(id)!.canonical_title;
  const count = spec.candidates.length;

  const sectors = spec.candidates
    .map((id, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + 40 * Math.cos(angle);
      const y = 50 + 40 * Math.sin(angle);
      return `<button type="button" class="sector" data-id="${id}" aria-pressed="false" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%">${esc(name(id))}</button>`;
    })
    .join("");
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r1 = i % 4 === 0 ? 86 : 90;
    return `<line x1="${100 + r1 * Math.cos(a)}" y1="${100 + r1 * Math.sin(a)}" x2="${100 + 95 * Math.cos(a)}" y2="${100 + 95 * Math.sin(a)}" />`;
  }).join("");
  const clues = spec.clues.map((c, i) => `<li><span class="plaque-num">${i + 1}</span>${esc(c.text)}.</li>`).join("");

  root.innerHTML = `
    <div class="astro-layout">
      <div class="astrolabe-board">
        <div class="dial">
          <svg viewBox="0 0 200 200" class="astro-svg" aria-hidden="true">
            <circle cx="100" cy="100" r="96" class="astro-rim" />
            <g class="astro-ticks">${ticks}</g>
            <g class="astro-rete"><circle cx="100" cy="100" r="70" /><ellipse cx="100" cy="100" rx="70" ry="38" /><path d="M30 100h140M100 30v140" /></g>
            <circle cx="100" cy="100" r="96" fill="url(#lv-spec)" opacity="0.25" />
          </svg>
          <div class="lens" aria-hidden="true"><span class="lens-mark">?</span></div>
        </div>
        <div class="sectors">${sectors}</div>
      </div>
      <div class="astro-side">
        <div class="plaques panel-lite"><h3>Riddle plaques</h3><ol>${clues}</ol>
          <p class="plaque-note">Every riddle is true of the hidden artifact. Tap a name to cloud it; tap again to restore it.</p></div>
        <p class="astro-status" aria-live="polite"></p>
      </div>
    </div>
    <div class="chamber-actions">
      <button type="button" class="btn brass big focus-btn" disabled>Focus the lens</button>
      <button type="button" class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const sectorEls = [...root.querySelectorAll<HTMLElement>(".sector")];
  const focusBtn = root.querySelector<HTMLButtonElement>(".focus-btn")!;
  const status = root.querySelector<HTMLElement>(".astro-status")!;
  const lit = () => spec.candidates.filter((id) => !clouded.has(id));
  const refresh = () => {
    for (const s of sectorEls) {
      const off = clouded.has(s.dataset.id!);
      s.classList.toggle("clouded", off);
      s.setAttribute("aria-pressed", String(off));
      s.setAttribute("aria-label", `${name(s.dataset.id!)}${off ? " (clouded)" : ""}`);
    }
    const left = lit();
    focusBtn.disabled = left.length !== 1;
    focusBtn.textContent = left.length === 1 ? `Focus the lens on ${name(left[0])}` : "Focus the lens";
    status.textContent = left.length === 1 ? "One light remains." : `${left.length} lights remain on the dial.`;
  };
  refresh();

  sectorEls.forEach((s) =>
    s.addEventListener("click", () => {
      const id = s.dataset.id!;
      if (clouded.has(id)) clouded.delete(id);
      else clouded.add(id);
      host.audio.brassClick();
      refresh();
    })
  );

  const revealHtml = () =>
    `<div class="astro-reveal"><h4>How the dial resolved</h4><ul>${spec.candidates
      .map((id) => {
        const e = data.byId.get(id)!;
        const broken = firstBrokenClue(e, spec.clues);
        const attrs = `${REGION_NAME[e.region_id] ?? ""} · ${ERA_NAME[attributeOf(e, "era")]?.replace(/^the /, "") ?? ""} · ${DOMAIN_NAME[e.primary_domain]?.replace(/^an? /, "") ?? ""} · ${CREATOR_SHORT[e.creator_type]}${e.era_year !== null ? ` · ${fmtYear(e.era_year)}` : ""}`;
        return `<li class="${id === spec.answer ? "answer" : ""}"><strong>${esc(e.canonical_title)}</strong><span>${esc(attrs)}</span><em>${id === spec.answer ? "fits every riddle" : `ruled out by riddle ${broken + 1}`}</em></li>`;
      })
      .join("")}</ul></div>`;

  focusBtn.addEventListener("click", () => {
    const left = lit();
    if (left.length !== 1) return;
    const id = left[0];
    if (id === spec.answer) {
      root.querySelector(".lens-mark")!.textContent = "✦";
      root.querySelector(".astrolabe-board")!.classList.add("solved");
      host.solve({ wrongPlacements: wrongTotal, brainstormTerms: [], reveal: revealHtml() });
      return;
    }
    wrongTotal++;
    clouded.add(id);
    const broken = firstBrokenClue(data.byId.get(id)!, spec.clues);
    refresh();
    host.msg(`The lens clouds over ${name(id)} — it breaks riddle ${broken + 1}. Restore a name you dimmed too soon.`, "nudge");
    host.audio.nudge();
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    const wrongLit = lit().filter((id) => id !== spec.answer);
    const answerClouded = clouded.has(spec.answer);
    nudge(
      host,
      () => (wrongLit.length === 0 && !answerClouded ? "Only the true light remains — focus the lens." : null),
      () => {
        if (wrongLit.length > 0) {
          const id = wrongLit[0];
          const broken = firstBrokenClue(data.byId.get(id)!, spec.clues);
          clouded.add(id);
          refresh();
          host.msg(`Nudge: ${name(id)} breaks riddle ${broken + 1} — the prism clouds it for you.`, "info");
        } else {
          clouded.delete(spec.answer);
          refresh();
          host.msg(`Nudge: you dimmed ${name(spec.answer)} too soon — it fits every riddle.`, "info");
        }
      }
    );
  });
}
