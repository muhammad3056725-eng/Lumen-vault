import type { ChamberSpec, Entity } from "@lumen-vault/shared-types";
import type { AsmrAudioEngine } from "../../engine/AsmrAudioEngine.js";
import type { Dataset } from "../../data.js";

export interface SolveDetail {
  wrongPlacements: number;
  brainstormTerms: Entity[];
  /** Kind-specific extra for the result screen (e.g. the astrolabe's reasoning). */
  reveal?: string;
}

export interface ChamberHost {
  msg(text: string, kind?: "info" | "nudge" | "good"): void;
  /** Spend one Insight Prism. Call ONLY when the nudge will do something. False when none left. */
  spendPrism(): boolean;
  prisms(): number;
  solve(detail: SolveDetail): void;
  announce(text: string): void;
  audio: AsmrAudioEngine;
}

export type ChamberRenderer = (root: HTMLElement, spec: ChamberSpec, data: Dataset, host: ChamberHost) => void;

export const EMPTY_POUCH = "Your prism pouch is empty — flawless first solves and rare brainstorms refill it.";

/** Common prism wrapper: only spends when `apply` reports it has a nudge to give. */
export function nudge(host: ChamberHost, canApply: () => string | null, apply: () => void) {
  const blocked = canApply();
  if (blocked) {
    host.msg(blocked, "good");
    return;
  }
  if (!host.spendPrism()) {
    host.msg(EMPTY_POUCH, "nudge");
    return;
  }
  apply();
}

export function tileHtml(id: string, titleHtml: string, label: string, extra = ""): string {
  return `<button type="button" class="tile vellum ${extra}" data-tile="${id}" aria-label="${label}"><span class="tile-text">${titleHtml}</span></button>`;
}
