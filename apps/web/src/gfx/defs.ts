/**
 * Shared vector assets: metallic brass gradients, specular highlights and
 * glow filters (injected once into an invisible <svg>), kind glyphs, and
 * the Wonder Artifact motif system ("glyph:frame", unique per card).
 */
import type { ChamberKind } from "@lumen-vault/shared-types";

export function installSvgDefs() {
  if (document.getElementById("lv-defs")) return;
  const holder = document.createElement("div");
  holder.innerHTML = `
  <svg id="lv-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="lv-brass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(--brass-hi)" />
        <stop offset="0.28" style="stop-color:var(--brass)" />
        <stop offset="0.52" style="stop-color:var(--brass-deep)" />
        <stop offset="0.74" style="stop-color:var(--brass)" />
        <stop offset="1" style="stop-color:var(--brass-hi)" />
      </linearGradient>
      <linearGradient id="lv-brass-v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--brass-hi)" />
        <stop offset="0.45" style="stop-color:var(--brass)" />
        <stop offset="1" style="stop-color:var(--brass-deep)" />
      </linearGradient>
      <radialGradient id="lv-core" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" style="stop-color:var(--glass-hi)" />
        <stop offset="0.6" style="stop-color:var(--glass-solid)" />
        <stop offset="1" style="stop-color:var(--base)" />
      </radialGradient>
      <radialGradient id="lv-lit" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stop-color="#fff6dc" />
        <stop offset="0.35" style="stop-color:var(--brass-hi)" />
        <stop offset="1" style="stop-color:var(--brass-deep)" />
      </radialGradient>
      <linearGradient id="lv-spec" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
        <stop offset="0.5" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="lv-goldfill" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" style="stop-color:var(--brass-deep)" />
        <stop offset="0.6" style="stop-color:var(--brass)" />
        <stop offset="1" stop-color="#fff3d6" />
      </linearGradient>
      <filter id="lv-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  </svg>`;
  document.body.appendChild(holder.firstElementChild!);
}

const KIND_PATHS: Record<ChamberKind, string> = {
  venn: `<circle cx="38" cy="42" r="20"/><circle cx="62" cy="42" r="20"/><circle cx="50" cy="62" r="20"/>`,
  chrono: `<path d="M50 18l5 9a24 24 0 0 1 9 4l10-3 4 8-8 7a24 24 0 0 1 0 10l8 7-4 8-10-3a24 24 0 0 1-9 4l-5 9h-8l-3-9a24 24 0 0 1-9-5l-10 3-4-8 8-7a24 24 0 0 1 0-10l-8-7 4-8 10 3a24 24 0 0 1 9-5l3-9z"/><circle cx="46" cy="50" r="8"/>`,
  forge: `<path d="M50 16L80 78H20z"/><path d="M50 16v62M50 46l15 32M50 46L35 78"/>`,
  astrolabe: `<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="18"/><path d="M50 14v12M50 74v12M14 50h12M74 50h12"/><path d="M50 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>`,
};

export function kindIcon(kind: ChamberKind, cls = "kind-icon"): string {
  return `<svg viewBox="0 0 100 100" class="${cls}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${KIND_PATHS[kind]}</svg>`;
}

/* ---------------- Wonder Artifact motifs ---------------- */

const GLYPHS: Record<string, string> = {
  lens: `<circle cx="45" cy="45" r="18"/><path d="M58 58l16 16"/><path d="M36 40a10 10 0 0 1 9-7"/>`,
  star: `<path d="M50 24l7 16 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2z"/>`,
  prism: `<path d="M50 24L74 70H26z"/><path d="M50 24v46M50 47l12 23M50 47L38 70"/>`,
  orb: `<circle cx="50" cy="46" r="18"/><path d="M36 74h28M42 68h16"/><path d="M42 40a9 9 0 0 1 8-6"/>`,
  crown: `<path d="M28 68l4-28 12 14 6-20 6 20 12-14 4 28z"/><path d="M28 76h44"/>`,
  compass: `<circle cx="50" cy="50" r="24"/><path d="M50 32l6 18-6 18-6-18z"/><circle cx="50" cy="50" r="2.5"/>`,
  gear: `<circle cx="50" cy="50" r="12"/><circle cx="50" cy="50" r="4"/><path d="M50 26v8M50 66v8M26 50h8M66 50h8M33 33l6 6M61 61l6 6M67 33l-6 6M39 61l-6 6"/>`,
  seed: `<path d="M50 76V40"/><path d="M50 52c-10 0-17-7-17-17 10 0 17 7 17 17z"/><path d="M50 46c0-10 7-17 17-17 0 10-7 17-17 17z"/>`,
  wave: `<path d="M24 58q9-16 18 0t18 0 18 0"/><path d="M24 70q9-16 18 0t18 0 18 0"/><path d="M30 44q10-14 22-6"/>`,
  shell: `<path d="M50 74c-16-10-21-28-13-40 8-12 26-12 34 0 9 13 1 30-21 40z"/><path d="M50 74V38M50 74L37 46M50 74l14-30"/>`,
  moon: `<path d="M60 26a24 24 0 1 0 16 36 19 19 0 0 1-16-36z"/>`,
  leaf: `<path d="M50 76c-18-13-19-37 0-50 19 13 18 37 0 50z"/><path d="M50 76V36"/>`,
  astrolabe: `<circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="14"/><path d="M50 22v8M50 70v8M22 50h8M70 50h8"/><circle cx="50" cy="50" r="3"/>`,
  feather: `<path d="M68 26c-20 4-34 20-35 44 21-3 33-19 35-44z"/><path d="M36 66l28-32"/>`,
  key: `<circle cx="38" cy="50" r="12"/><path d="M50 50h26M68 50v9M76 50v7"/>`,
  spiral: `<path d="M50 50m0-3a3 3 0 1 1 3 3 7 7 0 1 1-7-7 12 12 0 1 1 12 12 17 17 0 1 1-17-17 22 22 0 1 1 22 22"/>`,
  sun: `<circle cx="50" cy="50" r="12"/><path d="M50 26v8M50 66v8M26 50h8M66 50h8M33 33l5 5M62 62l5 5M67 33l-5 5M38 62l-5 5"/>`,
  mountain: `<path d="M22 72l20-32 10 14 8-10 18 28z"/><path d="M38 46l4-6 5 7"/>`,
  wing: `<path d="M26 64c16-2 30-12 44-34-4 20-14 36-30 42"/><path d="M34 62c8-4 16-12 22-22M42 66c8-4 14-10 20-20"/>`,
  eye: `<path d="M22 50c14-18 42-18 56 0-14 18-42 18-56 0z"/><circle cx="50" cy="50" r="8"/>`,
  flame: `<path d="M50 76c-12 0-18-9-16-19 2-9 10-13 10-24 10 7 16 15 16 24 4-3 5-7 5-10 5 6 6 12 4 17-2 8-9 12-19 12z"/>`,
  drop: `<path d="M50 24c10 16 18 26 18 36a18 18 0 0 1-36 0c0-10 8-20 18-36z"/><path d="M42 60a8 8 0 0 0 6 8"/>`,
  bolt: `<path d="M56 22L34 54h14l-6 24 24-34H52z"/>`,
  note: `<path d="M44 66V30l26-6v34"/><circle cx="38" cy="66" r="6"/><circle cx="64" cy="58" r="6"/>`,
  quill: `<path d="M70 24C46 32 36 50 32 74"/><path d="M70 24c-2 16-12 28-28 34"/><path d="M28 76l6-4"/>`,
  tower: `<path d="M42 76l6-50h4l6 50"/><path d="M38 76h24M44 56h12M46 40h8"/>`,
  reel: `<circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="4"/><circle cx="50" cy="38" r="5"/><circle cx="50" cy="62" r="5"/><circle cx="38" cy="50" r="5"/><circle cx="62" cy="50" r="5"/>`,
  comet: `<circle cx="62" cy="40" r="8"/><path d="M56 46L28 74M60 48L40 72M54 42L30 62"/>`,
  crystal: `<path d="M50 22l14 18-14 38-14-38z"/><path d="M36 40h28M50 22v56"/>`,
  lyre: `<path d="M38 72c-10-10-8-30 0-42M62 72c10-10 8-30 0-42"/><path d="M36 30h28M42 72h16M46 34v34M50 34v34M54 34v34"/>`,
  scroll: `<path d="M34 30h32v40H34z"/><path d="M30 30a4 4 0 0 1 8 0M62 70a4 4 0 0 0 8 0M40 40h20M40 48h20M40 56h14"/>`,
  mask: `<path d="M28 34c14-6 30-6 44 0 0 22-8 38-22 40-14-2-22-18-22-40z"/><path d="M38 46h8M54 46h8M42 60c5 3 11 3 16 0"/>`,
  fish: `<path d="M24 50c12-14 32-14 44 0-12 14-32 14-44 0z"/><path d="M68 50l10-10v20z"/><circle cx="36" cy="48" r="2"/>`,
  planet: `<circle cx="50" cy="50" r="14"/><path d="M24 58c10 6 44-4 52-18"/><path d="M26 58c-4-4 4-10 14-14"/>`,
  controller: `<path d="M30 42h40c8 0 10 26 2 26-6 0-8-8-14-8H42c-6 0-8 8-14 8-8 0-6-26 2-26z"/><path d="M38 48v8M34 52h8"/><circle cx="60" cy="50" r="2"/><circle cx="66" cy="54" r="2"/>`,
  bowl: `<path d="M24 50h52c0 14-12 24-26 24S24 64 24 50z"/><path d="M40 42c0-6 6-6 6-12M54 42c0-6 6-6 6-12"/>`,
  anchor: `<circle cx="50" cy="30" r="5"/><path d="M50 35v40M38 46h24"/><path d="M28 60c4 10 12 15 22 15s18-5 22-15"/>`,
  hourglass: `<path d="M34 24h32M34 76h32M38 24c0 16 24 18 24 26s-24 10-24 26M62 24c0 16-24 18-24 26s24 10 24 26"/>`,
  flask: `<path d="M44 24h12M46 24v16L32 70a4 4 0 0 0 4 6h28a4 4 0 0 0 4-6L54 40V24"/><path d="M38 60h24"/>`,
};

const FRAMES: Record<string, string> = {
  ring: `<circle cx="50" cy="50" r="44" class="mf"/><circle cx="50" cy="50" r="39" class="mf thin"/>`,
  diamond: `<path d="M50 4L96 50 50 96 4 50z" class="mf"/><path d="M50 12L88 50 50 88 12 50z" class="mf thin"/>`,
  rays: `<circle cx="50" cy="50" r="38" class="mf thin"/>${Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r1 = 41;
    const r2 = i % 2 ? 46 : 49;
    return `<path d="M${(50 + r1 * Math.cos(a)).toFixed(1)} ${(50 + r1 * Math.sin(a)).toFixed(1)}L${(50 + r2 * Math.cos(a)).toFixed(1)} ${(50 + r2 * Math.sin(a)).toFixed(1)}" class="mf"/>`;
  }).join("")}`,
  arch: `<path d="M14 94V40a36 36 0 0 1 72 0v54z" class="mf"/><path d="M20 94V41a30 30 0 0 1 60 0v53" class="mf thin"/>`,
};

export function motifSvg(motif: string, cls = "motif"): string {
  const [glyph, frame] = motif.split(":");
  const g = GLYPHS[glyph] ?? GLYPHS.star;
  const f = FRAMES[frame] ?? FRAMES.ring;
  return `<svg viewBox="0 0 100 100" class="${cls}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${f}<g class="mg">${g}</g></svg>`;
}

export const GLYPH_NAMES = Object.keys(GLYPHS);
