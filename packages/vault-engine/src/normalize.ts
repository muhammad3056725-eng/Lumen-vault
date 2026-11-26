/**
 * Input normalization & hygiene (Blueprint H6 + M3).
 *
 * Every brainstorm input is: Unicode NFKC normalized, lowercased,
 * stripped of punctuation, relieved of leading articles (the/a/an),
 * whitespace-collapsed, then evaluated against canonical titles and
 * alias maps. Matching accepts common acronyms and a Levenshtein
 * edit distance <= 1 for inputs of length >= 6 (M3). Inputs are
 * scrubbed by a profanity filter before validation (H6).
 */

const ARTICLES = new Set(["the", "a", "an"]);

/** Small starter blocklist; the pipeline can extend it from data. */
export const PROFANITY_BLOCKLIST: ReadonlySet<string> = new Set([
  "damn",
  "hell",
  "shit",
  "fuck",
  "bitch",
  "bastard",
  "whore",
  "slut",
  "dick",
  "pussy",
  "nigger",
  "faggot",
]);

export function normalizeInput(raw: string): string {
  const nfkc = raw.normalize("NFKC").toLowerCase();
  const cleaned = nfkc
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}

/** True when the (normalized) input contains a blocklisted token. */
export function containsProfanity(normalized: string): boolean {
  return normalized
    .split(" ")
    .some((w) => PROFANITY_BLOCKLIST.has(w));
}

/** Classic Levenshtein distance, early-exit above `max`. */
export function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export type MatchVia = "canonical" | "alias" | "acronym" | "fuzzy";

export interface MatchResult {
  entityId: string;
  via: MatchVia;
  normalized: string;
}

interface Matchable {
  entity_id: string;
  canonical_title: string;
  aliases: string[];
}

/**
 * Resolve a free-text brainstorm answer to an entity (M3 forgiving
 * matching). Returns null when nothing matches or the input is
 * profane/empty. Acronym matching treats the input as the initials
 * of a canonical title (e.g. "lotr", "jwst" via aliases).
 */
export function matchEntity(
  rawInput: string,
  entities: readonly Matchable[]
): MatchResult | null {
  const normalized = normalizeInput(rawInput);
  if (!normalized || containsProfanity(normalized)) return null;

  for (const e of entities) {
    if (normalizeInput(e.canonical_title) === normalized) {
      return { entityId: e.entity_id, via: "canonical", normalized };
    }
  }
  for (const e of entities) {
    for (const alias of e.aliases) {
      if (normalizeInput(alias) === normalized) {
        return { entityId: e.entity_id, via: "alias", normalized };
      }
    }
  }
  // Acronym: initials of the canonical title, e.g. "lotr".
  if (/^[a-z]{2,6}$/.test(normalized)) {
    for (const e of entities) {
      const initials = normalizeInput(e.canonical_title)
        .split(" ")
        .map((w) => w[0])
        .join("");
      if (initials === normalized) {
        return { entityId: e.entity_id, via: "acronym", normalized };
      }
    }
  }
  // Fuzzy: edit distance <= 1 for inputs of length >= 6 (M3).
  if (normalized.length >= 6) {
    let best: { id: string; d: number } | null = null;
    for (const e of entities) {
      const candidates = [e.canonical_title, ...e.aliases];
      for (const c of candidates) {
        const d = levenshtein(normalized, normalizeInput(c), 1);
        if (d <= 1 && (best === null || d < best.d)) {
          best = { id: e.entity_id, d };
        }
      }
    }
    if (best) return { entityId: best.id, via: "fuzzy", normalized };
  }
  return null;
}
