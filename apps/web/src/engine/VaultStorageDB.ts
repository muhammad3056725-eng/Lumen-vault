/**
 * VaultStorageDB (Blueprint §6): persistent progression — solved
 * chambers, collected Wonder Artifact Cards, Insight Prism balance,
 * lifetime score, daily runs. Implemented over localStorage (the
 * static host has no backend; an IndexedDB adapter can replace this
 * class without touching callers).
 */
export interface ChamberRunRecord {
  chamberId: string;
  stars: number;
  score: number;
  seconds: number;
}

export interface DailyRunRecord {
  date: string;
  number: number;
  chambers: ChamberRunRecord[];
  finished: boolean;
  totalScore: number;
  prismsEarned: number;
}

export interface VaultProgress {
  solvedChambers: string[];
  artifacts: string[];
  prisms: number;
  rareBrainstormCount: number;
  totalScore: number;
  dailyRuns: Record<string, DailyRunRecord>;
  muted: boolean;
  palette: string;
}

const KEY = "lumen-vault:progress:v1";
export const STARTING_PRISMS = 3;

export function defaultProgress(): VaultProgress {
  return {
    solvedChambers: [],
    artifacts: [],
    prisms: STARTING_PRISMS,
    rareBrainstormCount: 0,
    totalScore: 0,
    dailyRuns: {},
    muted: false,
    palette: "midnight",
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
      if (!raw) return defaultProgress();
      return { ...defaultProgress(), ...(JSON.parse(raw) as VaultProgress) };
    } catch {
      return defaultProgress();
    }
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
  recordSolve(chamberId: string, artifactId: string | undefined, score: number): boolean {
    const first = !this.isSolved(chamberId);
    if (first) {
      this.progress.solvedChambers.push(chamberId);
      if (artifactId && !this.progress.artifacts.includes(artifactId)) {
        this.progress.artifacts.push(artifactId);
      }
    }
    this.progress.totalScore += score;
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
}
