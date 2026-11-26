/**
 * Chamber C — the Resonance Forge. Offer three answers that satisfy every
 * rune; the prism fills with liquid gold. Unknown names never count
 * against you — only known answers that break a rune do.
 */
import type { Entity, ForgeChamberSpec } from "@lumen-vault/shared-types";
import { evaluateForgeAnswer, forgePool, isRare, letterCount } from "@lumen-vault/vault-engine";
import type { Dataset } from "../../data.js";
import { esc } from "../../util.js";
import { nudge, type ChamberHost } from "./common.js";

export function renderForge(root: HTMLElement, spec: ForgeChamberSpec, data: Dataset, host: ChamberHost) {
  const used = new Set<string>();
  const terms: Entity[] = [];
  let wrongTotal = 0;
  const hintStage = new Map<string, number>();
  const pool = forgePool(spec, data.entities).sort((a, b) => b.notability_score - a.notability_score);

  const runes = spec.constraints.map((c, i) => `<li class="rune"><span class="rune-mark" aria-hidden="true">${["✧", "◇", "✦"][i] ?? "✧"}</span>${esc(c.label)}</li>`).join("");
  root.innerHTML = `
    <div class="forge-layout">
      <div class="forge-stage">
        <svg viewBox="0 0 200 190" class="prism-svg" aria-hidden="true">
          <defs><clipPath id="prism-clip-${spec.id}"><path d="M100 12 L172 168 L28 168 Z" /></clipPath></defs>
          <path d="M100 12 L172 168 L28 168 Z" class="prism-body" />
          <g clip-path="url(#prism-clip-${spec.id})">
            <rect class="prism-fill" x="0" y="0" width="200" height="190" fill="url(#lv-goldfill)" style="transform:translateY(190px)" />
            <path class="prism-surface" d="M0 0 Q 25 -6 50 0 T 100 0 T 150 0 T 200 0 V 8 H 0 Z" fill="#fff3d6" opacity="0.55" style="transform:translateY(190px)" />
          </g>
          <path d="M100 12 L172 168 L28 168 Z" class="prism-outline" />
          <path d="M100 12 L100 168 M100 84 L136 168 M100 84 L64 168" class="prism-facet" />
          <path d="M100 12 L120 56" class="prism-spec" />
        </svg>
        <p class="forge-count"><strong class="drunk">0</strong> of ${spec.answersNeeded} lights</p>
      </div>
      <div class="forge-side">
        <ul class="runes" aria-label="Runes">${runes}</ul>
        <form class="forge-form">
          <input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Offer an answer…" aria-label="Forge answer" />
          <button type="submit" class="btn brass">Offer</button>
        </form>
        <ul class="forge-answers" aria-live="polite"></ul>
      </div>
    </div>
    <div class="chamber-actions">
      <button type="button" class="btn ghost hint-btn">✦ Insight Prism nudge</button>
    </div>`;

  const fill = root.querySelector<SVGRectElement>(".prism-fill")!;
  const surface = root.querySelector<SVGPathElement>(".prism-surface")!;
  const drunk = root.querySelector(".drunk")!;
  const list = root.querySelector(".forge-answers")!;
  const input = root.querySelector<HTMLInputElement>(".forge-form input")!;
  const setFill = () => {
    const ratio = Math.min(1, used.size / spec.answersNeeded);
    const y = 190 - 178 * ratio;
    fill.style.transform = `translateY(${y}px)`;
    surface.style.transform = `translateY(${y - 4}px)`;
    drunk.textContent = String(used.size);
  };

  const accept = (entity: Entity, countSpark: boolean) => {
    used.add(entity.entity_id);
    if (countSpark) terms.push(entity);
    const li = document.createElement("li");
    li.className = "forge-answer";
    li.textContent = `${entity.canonical_title}${isRare(entity) && countSpark ? " — a rare spark" : countSpark ? "" : " — poured by the prism"}`;
    list.appendChild(li);
    setFill();
    host.audio.goldPour();
    if (used.size >= spec.answersNeeded) {
      input.disabled = true;
      setTimeout(() => host.solve({ wrongPlacements: wrongTotal, brainstormTerms: terms }), 650);
    }
  };

  root.querySelector<HTMLFormElement>(".forge-form")!.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!input.value.trim() || used.size >= spec.answersNeeded) return;
    const result = evaluateForgeAnswer(input.value, spec, data.entities, used, data.byId);
    if (!result.accepted || !result.entity) {
      if (result.countsAsWrong) {
        wrongTotal++;
        host.audio.nudge();
      }
      host.msg(result.reason, result.outcome === "unknown" ? "info" : "nudge");
      return;
    }
    input.value = "";
    host.msg(result.reason, "good");
    accept(result.entity, true);
  });

  root.querySelector(".hint-btn")!.addEventListener("click", () => {
    const remaining = pool.filter((e) => !used.has(e.entity_id));
    nudge(
      host,
      () => (remaining.length === 0 || used.size >= spec.answersNeeded ? "The prism is already full of light." : null),
      () => {
        const pick = remaining[0];
        const stage = (hintStage.get(pick.entity_id) ?? 0) + 1;
        hintStage.set(pick.entity_id, stage);
        const title = pick.canonical_title;
        const bare = title.replace(/^(The|A|An)\s+/i, "");
        if (stage === 1) {
          host.msg(`Nudge: one answer begins with “${bare.charAt(0)}”.`, "info");
        } else if (stage === 2) {
          host.msg(`Nudge: the prism dreams of “${bare.charAt(0)}…${bare.charAt(bare.length - 1)}” — ${letterCount(title)} letters of light.`, "info");
        } else {
          host.msg(`The prism pours ${title} in by itself — no spark, but the light is real.`, "good");
          accept(pick, false);
        }
      }
    );
  });
}
