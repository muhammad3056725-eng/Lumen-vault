/** Small DOM helpers shared by the views. */

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape dataset text before it goes into an HTML template. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function $(root: ParentNode, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}

export function fmtYear(y: number | null): string {
  if (y === null) return "timeless";
  return y < 0 ? `${-y} BCE` : String(y);
}
