/**
 * ShareCardRenderer: the plain-text Constellation Sharecard.
 * Stars per chamber come from `starsFor` (3, −1 per nudge, −1 for any
 * misstep, floor 1); the note states the real nudge/misstep counts.
 */
import type { ChamberKind } from "@lumen-vault/shared-types";

export interface ChamberResult {
  kind: ChamberKind;
  label?: string;
  stars: number; // 0..3 (0 = not cleared)
  nudges?: number;
  wrong?: number;
  note?: string;
  pathCode: string;
}

export interface ShareCardInput {
  dailyNumber: number;
  cleared: number;
  total: number;
  timeSeconds: number;
  score: number;
  prisms: number;
  chambers: ChamberResult[];
  goldRun: boolean;
}

const KIND_LABEL: Record<ChamberKind, string> = {
  venn: "Venn Lock",
  chrono: "Chrono Gear",
  forge: "Resonance Forge",
  astrolabe: "Astrolabe",
};

function stars(n: number): string {
  return [0, 1, 2].map((i) => (i < n ? "*" : "o")).join(" ");
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const WIDTH = 57;

function line(text: string): string {
  const inner = WIDTH - 3;
  const t = text.length > inner ? text.slice(0, inner - 1) + "…" : text;
  return `| ${t.padEnd(inner)}|`;
}

export function noteFor(c: ChamberResult): string {
  if (c.note) return c.note;
  if (c.stars === 0) return "Sealed";
  const nudges = c.nudges ?? 0;
  const wrong = c.wrong ?? 0;
  if (nudges === 0 && wrong === 0) return "Flawless";
  const parts: string[] = [];
  if (nudges) parts.push(`${nudges} nudge${nudges > 1 ? "s" : ""}`);
  if (wrong) parts.push(`${wrong} misstep${wrong > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export function renderShareCard(input: ShareCardInput): string {
  const border = `+${"-".repeat(WIDTH - 2)}+`;
  const rows: string[] = [border];
  rows.push(line(`LUMEN VAULT DAILY #${String(input.dailyNumber).padStart(3, "0")} - ${input.cleared}/${input.total} CHAMBERS CLEARED`));
  rows.push(line(`Time: ${mmss(input.timeSeconds)} | Score: ${input.score.toLocaleString("en-US")} | Prisms: +${input.prisms}`));
  rows.push(line(""));
  input.chambers.forEach((c, i) => {
    const label = c.label ?? (i === input.chambers.length - 1 && input.total >= 5 ? "Master Vault" : KIND_LABEL[c.kind]);
    rows.push(line(`[${label}]`.padEnd(19) + `${stars(c.stars)}  ${noteFor(c)}`));
  });
  rows.push(line(""));
  const path = input.chambers.map((c) => c.pathCode).join("-");
  rows.push(line(`Path: ${path}${input.goldRun ? " [GOLD FLUID RUN]" : ""}`));
  rows.push(border);
  return rows.join("\n");
}
