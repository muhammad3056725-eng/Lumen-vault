/**
 * ShareCardRenderer (Blueprint §2): the plain-text Constellation
 * Sharecard. Stars per chamber: 3 = flawless, minus 1 per Insight
 * Prism nudge spent in that chamber (floor 0).
 */
import type { ChamberKind } from "@lumen-vault/shared-types";

export interface ChamberResult {
  kind: ChamberKind;
  label?: string;
  stars: number; // 0..3
  note?: string; // e.g. "1 Nudge", "Rare Spark: \"Solaris\""
  pathCode: string; // e.g. "A1"
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

const WIDTH = 55;

function line(text: string): string {
  return `| ${text.padEnd(WIDTH - 3)}|`;
}

export function renderShareCard(input: ShareCardInput): string {
  const border = `+${"-".repeat(WIDTH - 1)}+`;
  const rows: string[] = [border];
  rows.push(
    line(
      `LUMEN VAULT DAILY #${String(input.dailyNumber).padStart(3, "0")} - ${input.cleared}/${input.total} CHAMBERS CLEARED`
    )
  );
  rows.push(
    line(
      `Time: ${mmss(input.timeSeconds)} | Score: ${input.score.toLocaleString("en-US")} | Insight Prisms: ${input.prisms}`
    )
  );
  rows.push(line(""));
  input.chambers.forEach((c, i) => {
    const label = c.label ?? (i === input.chambers.length - 1 && input.total >= 5 ? "Master Vault" : KIND_LABEL[c.kind]);
    const note = c.note ?? (c.stars === 3 ? "Flawless" : `${3 - c.stars} Nudge${3 - c.stars > 1 ? "s" : ""}`);
    rows.push(line(`[${label}]`.padEnd(20) + `--> ${stars(c.stars)} (${note})`));
  });
  rows.push(line(""));
  const path = input.chambers.map((c) => c.pathCode).join("-");
  rows.push(line(`Constellation Path: ${path}${input.goldRun ? " [GOLD FLUID RUN]" : ""}`));
  rows.push(border);
  return rows.join("\n");
}
