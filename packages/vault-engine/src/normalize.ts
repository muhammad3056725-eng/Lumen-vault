/**
 * Input normalization & forgiving matching.
 *
 * Every typed answer is: NFKD-normalized with diacritics folded,
 * lowercased, apostrophes removed (so "Schindler's" == "schindlers"),
 * other punctuation turned into spaces, number words and small Roman
 * numerals turned into digits, and relieved of a leading article.
 *
 * Matching tiers (highest wins; ties are broken by the caller's
 * `prefer` predicate so "Dune" resolves to the novel in a literature
 * chamber and to the film in a cinema chamber):
 *   100 canonical title · 95 alias · 80 acronym (≥3 letters, ≥3-word
 *   titles) · 70/65 fuzzy (edit distance 1 for ≥6 chars, 2 for ≥10)
 *   · 77–82 token-subset partial ("night music" → "Eine kleine
 *   Nachtmusik" via its alias "a little night music").
 * The profanity filter runs only when nothing matched, so titles such
 * as "Moby-Dick" are never blocked.
 */

const ARTICLES = new Set(["the", "a", "an"]);
const STOPWORDS = new Set(["the", "a", "an", "of", "and", "in", "on", "to", "for", "at", "with", "no", "de", "la", "le", "el"]);

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ROMAN: Record<string, number> = { ii: 2, iii: 3, iv: 4, vi: 6, vii: 7, viii: 8, ix: 9 };

/** Small blocklist, applied only to inputs that matched nothing. */
export const PROFANITY_BLOCKLIST: ReadonlySet<string> = new Set([
  "damn", "shit", "fuck", "fucking", "bitch", "bastard", "whore", "slut", "dick", "pussy", "cunt", "nigger", "faggot",
]);

function numberize(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in TENS) {
      const next = words[i + 1];
      if (next !== undefined && next in NUMBER_WORDS && NUMBER_WORDS[next] < 10 && NUMBER_WORDS[next] > 0) {
        out.push(String(TENS[w] + NUMBER_WORDS[next]));
        i++;
      } else out.push(String(TENS[w]));
    } else if (w in NUMBER_WORDS) out.push(String(NUMBER_WORDS[w]));
    else if (w in ROMAN) out.push(String(ROMAN[w]));
    else out.push(w);
  }
  return out;
}

export function normalizeInput(raw: string): string {
  const folded = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ßẞ]/g, "ss")
    .replace(/[æ]/g, "ae")
    .replace(/[œ]/g, "oe")
    .replace(/[øØ]/g, "o")
    .replace(/&/g, " and ");
  const cleaned = folded
    .replace(/['’ʼ‘`´]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  let words = cleaned.split(" ").filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  words = numberize(words);
  return words.join(" ");
}

/** True when the (normalized) input contains a blocklisted token. */
export function containsProfanity(normalized: string): boolean {
  return normalized.split(" ").some((w) => PROFANITY_BLOCKLIST.has(w));
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

/** Letters only (no spaces/digits/punctuation) — for "N letters of light". */
export function letterCount(s: string): number {
  return (s.match(/\p{L}/gu) ?? []).length;
}

export type MatchVia = "canonical" | "alias" | "acronym" | "fuzzy" | "partial";

export interface MatchResult {
  entityId: string;
  via: MatchVia;
  normalized: string;
  /** The dictionary name the input was heard as (canonical title). */
  heardAs: string;
}

interface Matchable {
  entity_id: string;
  canonical_title: string;
  aliases: string[];
}

interface IndexedName {
  id: string;
  title: string;
  norm: string;
  kind: "canonical" | "alias";
  tokens: string[];
  content: string[];
  initials: string | null;
}

const indexCache = new WeakMap<readonly Matchable[], IndexedName[]>();

function contentTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t));
}

function buildIndex(entities: readonly Matchable[]): IndexedName[] {
  const cached = indexCache.get(entities);
  if (cached) return cached;
  const out: IndexedName[] = [];
  for (const e of entities) {
    const names: [string, "canonical" | "alias"][] = [
      [e.canonical_title, "canonical"],
      ...e.aliases.map((a) => [a, "alias"] as [string, "alias"]),
    ];
    for (const [name, kind] of names) {
      const norm = normalizeInput(name);
      if (!norm) continue;
      const tokens = norm.split(" ");
      const words = normalizeInput(name.replace(/[-–—]/g, " ")).split(" ");
      out.push({
        id: e.entity_id,
        title: e.canonical_title,
        norm,
        kind,
        tokens,
        content: contentTokens(tokens),
        initials: kind === "canonical" && words.length >= 3 ? words.map((w) => w[0]).join("") : null,
      });
    }
  }
  indexCache.set(entities, out);
  return out;
}

function tokenMatches(inputTok: string, nameTok: string): boolean {
  if (inputTok === nameTok) return true;
  if (inputTok.length >= 5 && nameTok.length >= 5) return levenshtein(inputTok, nameTok, 1) <= 1;
  return false;
}

interface Scored {
  id: string;
  title: string;
  score: number;
  via: MatchVia;
}

/** Every dictionary entity the input could mean, best first. */
export function matchCandidates(rawInput: string, entities: readonly Matchable[]): { normalized: string; candidates: Scored[] } {
  const normalized = normalizeInput(rawInput);
  if (!normalized) return { normalized, candidates: [] };
  const index = buildIndex(entities);
  const best = new Map<string, Scored>();
  const offer = (n: IndexedName, score: number, via: MatchVia) => {
    const prev = best.get(n.id);
    if (!prev || prev.score < score) best.set(n.id, { id: n.id, title: n.title, score, via });
  };
  const inputTokens = normalized.split(" ");
  const inputContent = contentTokens(inputTokens);
  const compact = normalized.replace(/ /g, "");
  for (const n of index) {
    if (n.norm === normalized) {
      offer(n, n.kind === "canonical" ? 100 : 95, n.kind);
      continue;
    }
    if (n.norm.replace(/ /g, "") === compact) {
      offer(n, 90, n.kind);
      continue;
    }
    if (n.initials && /^[a-z0-9]{3,6}$/.test(normalized) && n.initials === normalized) {
      offer(n, 80, "acronym");
      continue;
    }
    if (normalized.length >= 6) {
      const max = normalized.length >= 10 ? 2 : 1;
      const d = levenshtein(normalized, n.norm, max);
      if (d <= max) {
        offer(n, 70 - (d - 1) * 5, "fuzzy");
        continue;
      }
    }
    // Token-subset partial match.
    if (inputContent.length > 0 && n.content.length > 0) {
      const single = inputContent.length === 1;
      if (single && inputContent[0].length < 6) continue;
      if (inputContent.join("").length < 4) continue;
      const all = inputContent.every((t) => n.content.some((nt) => tokenMatches(t, nt)));
      if (!all) continue;
      const coverage = inputContent.length / n.content.length;
      if (coverage >= 0.5) offer(n, 72 + Math.round(Math.min(1, coverage) * 10), "partial");
    }
  }
  const candidates = [...best.values()].sort((a, b) => b.score - a.score);
  return { normalized, candidates };
}

/**
 * Resolve free-text input to one entity. When several entities match
 * in the same tier (score within 10 of the best), `prefer` decides —
 * e.g. "the one that satisfies this chamber's runes". Returns null when
 * nothing matches (and for profane inputs that match nothing).
 */
export function matchEntity(
  rawInput: string,
  entities: readonly Matchable[],
  prefer?: (entityId: string) => boolean
): MatchResult | null {
  const { normalized, candidates } = matchCandidates(rawInput, entities);
  if (candidates.length === 0) return null;
  const top = candidates[0].score;
  const tier = candidates.filter((c) => c.score >= top - 10);
  // A chamber-satisfying reading wins over a merely closer spelling:
  // "Apollo 13" in a space forge means the mission, not the film.
  const pick = (prefer && (tier.find((c) => prefer(c.id)) ?? candidates.find((c) => prefer(c.id)))) || tier[0];
  if (!pick) return null;
  return { entityId: pick.id, via: pick.via, normalized, heardAs: pick.title };
}

/** Convenience for UI copy: true if the input is unmatched AND profane. */
export function isUnmatchedProfanity(rawInput: string, entities: readonly Matchable[]): boolean {
  return matchEntity(rawInput, entities) === null && containsProfanity(normalizeInput(rawInput));
}
