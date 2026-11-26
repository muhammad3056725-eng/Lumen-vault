/**
 * VaultStorageDB: persistent progression — solved chambers, best stars,
 * collected Wonder Artifact Cards, Insight Prism balance, lifetime score,
 * daily runs, settings. localStorage-backed, validated on load, with a
 * migration from the v1 save format (balances and settings carry over;
 * chamber ids were re-minted with the new content, so v1 solves do not).
 */
export interface ChamberRunRecord {
  chamberId: string;
  stars: number;
  score: number;
  seconds: number;
  nudges: number;
  wrong: number;
}

export interface DailyRunRecord {
  date: string;
  number: number;
  chambers: ChamberRunRecord[];
  finished: boolean;
  totalScore: number;
  prismsEarned: number;
}

export interface BestRecord {
  stars: number;
  score: number;
}

export interface VaultProgress {
  version: 2;
  solvedChambers: string[];
  best: Record<string, BestRecord>;
  artifacts: string[];
  prisms: number;
  rareBrainstormCount: number;
  totalScore: number;
  dailyRuns: Record<string, DailyRunRecord>;
  muted: boolean;
  palette: string;
}

const KEY = "lumen-vault:progress:v2";
const LEGACY_KEY = "lumen-vault:progress:v1";
export const STARTING_PRISMS = 3;
const PALETTES = new Set(["midnight", "alabaster", "amethyst", "jade"]);

export function defaultProgress(): VaultProgress {
  return {
    version: 2,
    solvedChambers: [],
    best: {},
    artifacts: [],
    prisms: STARTING_PRISMS,
    rareBrainstormCount: 0,
    totalScore: 0,
    dailyRuns: {},
    muted: false,
    palette: "midnight",
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function sanitize(raw: Record<string, unknown>): VaultProgress {
  const d = defaultProgress();
  const best: Record<string, BestRecord> = {};
  if (raw.best && typeof raw.best === "object") {
    for (const [k, v] of Object.entries(raw.best as Record<string, BestRecord>)) {
      if (v && typeof v === "object") best[k] = { stars: num(v.stars, 0), score: num(v.score, 0) };
    }
  }
  const dailyRuns: Record<string, DailyRunRecord> = {};
  if (raw.dailyRuns && typeof raw.dailyRuns === "object") {
    const entries = Object.entries(raw.dailyRuns as Record<string, DailyRunRecord>).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60);
    for (const [k, v] of entries) {
      if (!v || typeof v !== "object" || !Array.isArray(v.chambers)) continue;
      dailyRuns[k] = {
        date: String(v.date ?? k),
        number: num(v.number, 1),
        chambers: v.chambers
          .filter((c) => c && typeof c.chamberId === "string")
          .map((c) => ({ chamberId: c.chamberId, stars: num(c.stars, 1), score: num(c.score, 0), seconds: num(c.seconds, 0), nudges: num(c.nudges, 0), wrong: num(c.wrong, 0) })),
        finished: !!v.finished,
        totalScore: num(v.totalScore, 0),
        prismsEarned: num(v.prismsEarned, 0),
      };
    }
  }
  return {
    version: 2,
    solvedChambers: strs(raw.solvedChambers),
    best,
    artifacts: strs(raw.artifacts),
    prisms: num(raw.prisms, d.prisms),
    rareBrainstormCount: num(raw.rareBrainstormCount, 0),
    totalScore: num(raw.totalScore, 0),
    dailyRuns,
    muted: typeof raw.muted === "boolean" ? raw.muted : d.muted,
    palette: typeof raw.palette === "string" && PALETTES.has(raw.palette) ? raw.palette : d.palette,
  };
}

export class VaultStorageDB {
  private progress: VaultProgress;

  constructor() {
    this.progress = this.load();
  }

  private load(): VaultProgress {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return sanitize(JSON.parse(raw));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const old = JSON.parse(legacy) as Record<string, unknown>;
        return sanitize({ prisms: old.prisms, totalScore: old.totalScore, muted: old.muted, palette: old.palette, rareBrainstormCount: old.rareBrainstormCount });
      }
    } catch {
      /* corrupt or unavailable storage — start fresh */
    }
    return defaultProgress();
  }

  get data(): VaultProgress {
    return this.progress;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.progress));
    } catch {
      /* storage unavailable (private mode) — the vault simply forgets */
    }
  }

  isSolved(chamberId: string): boolean {
    return this.progress.solvedChambers.includes(chamberId);
  }

  /** Record a solve; returns true when this is the first solve. */
  recordSolve(chamberId: string, artifactId: string | undefined, score: number, stars: number): boolean {
    const first = !this.isSolved(chamberId);
    if (first) {
      this.progress.solvedChambers.push(chamberId);
      if (artifactId && !this.progress.artifacts.includes(artifactId)) this.progress.artifacts.push(artifactId);
      this.progress.totalScore += score;
    }
    const prev = this.progress.best[chamberId];
    if (!prev || stars > prev.stars || (stars === prev.stars && score > prev.score)) {
      this.progress.best[chamberId] = { stars, score };
    }
    this.save();
    return first;
  }

  addPrisms(n: number) {
    this.progress.prisms = Math.max(0, this.progress.prisms + n);
    this.save();
  }

  spendPrism(): boolean {
    if (this.progress.prisms <= 0) return false;
    this.progress.prisms -= 1;
    this.save();
    return true;
  }

  addRareBrainstorms(n: number) {
    this.progress.rareBrainstormCount += n;
    this.save();
  }

  dailySolved(date: string, chamberId: string): boolean {
    return !!this.progress.dailyRuns[date]?.chambers.some((c) => c.chamberId === chamberId);
  }
}
