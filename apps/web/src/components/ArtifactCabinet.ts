/**
 * ArtifactCabinet (Blueprint §2/S3): the player's collection of
 * Wonder Artifact Cards — cream vellum cards with vector motif art,
 * a 2-sentence curated lore story, and 2.5D tilt + specular glint.
 * Uncollected chambers show as quiet silhouettes.
 */
import type { ArtifactCard, ChamberSpec } from "@lumen-vault/shared-types";
import { attachTilt } from "./drag.js";

export function motifSvg(motif: string): string {
  const s = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"';
  const inner: Record<string, string> = {
    spiral: `<path ${s} d="M50 50 m0 -4 a4 4 0 1 1 4 4 a8 8 0 1 1 -8 -8 a14 14 0 1 1 14 14 a20 20 0 1 1 -20 -20 a27 27 0 1 1 27 27"/>`,
    gear: `<circle ${s} cx="50" cy="50" r="13"/><circle ${s} cx="50" cy="50" r="5"/><path ${s} d="M50 22v10M50 68v10M22 50h10M68 50h10M30 30l7 7M63 63l7 7M70 30l-7 7M37 63l-7 7"/>`,
    prism: `<path ${s} d="M50 18 L82 78 L18 78 Z"/><path ${s} d="M50 18 L50 78 M50 44 L68 78 M50 44 L32 78"/>`,
    astrolabe: `<circle ${s} cx="50" cy="50" r="30"/><circle ${s} cx="50" cy="50" r="19"/><circle ${s} cx="50" cy="50" r="4"/><path ${s} d="M50 12v10M50 78v10M12 50h10M78 50h10"/>`,
    wave: `<path ${s} d="M14 62 q12 -22 24 0 q12 22 24 0 q12 -22 24 0"/><path ${s} d="M14 78 q12 -22 24 0 q12 22 24 0 q12 -22 24 0"/>`,
    feather: `<path ${s} d="M72 20 C46 26 28 46 26 76 C54 72 70 52 72 20 Z"/><path ${s} d="M30 72 L66 30"/>`,
    key: `<circle ${s} cx="38" cy="50" r="17"/><path ${s} d="M55 50 H84 M74 50 v12 M84 50 v9"/>`,
    orb: `<circle ${s} cx="50" cy="46" r="24"/><path ${s} d="M30 82 h40 M38 74 h24"/>`,
    leaf: `<path ${s} d="M50 84 C26 66 24 34 50 16 C76 34 74 66 50 84 Z"/><path ${s} d="M50 84 V30"/>`,
    star: `<path ${s} d="M50 16 L59 40 L84 40 L64 55 L71 80 L50 65 L29 80 L36 55 L16 40 L41 40 Z"/>`,
    moon: `<path ${s} d="M64 14 A38 38 0 1 0 86 62 A30 30 0 0 1 64 14 Z"/>`,
    shell: `<path ${s} d="M50 84 C28 70 22 46 32 30 C42 15 66 14 76 30 C88 48 76 72 50 84 Z"/><path ${s} d="M50 84 L50 32 M50 84 L32 44 M50 84 L70 42"/>`,
    crown: `<path ${s} d="M20 70 L26 34 L42 52 L50 28 L58 52 L74 34 L80 70 Z"/><path ${s} d="M20 80 h60"/>`,
    lens: `<circle ${s} cx="44" cy="44" r="22"/><path ${s} d="M60 60 L84 84"/>`,
    seed: `<path ${s} d="M50 82 C50 60 50 44 50 30"/><path ${s} d="M50 44 C38 44 30 36 30 24 C42 24 50 32 50 44 Z"/><path ${s} d="M50 38 C50 26 58 18 70 18 C70 30 62 38 50 38 Z"/>`,
    compass: `<circle ${s} cx="50" cy="50" r="32"/><path ${s} d="M50 28 L58 50 L50 72 L42 50 Z"/><circle ${s} cx="50" cy="50" r="3"/>`,
  };
  return `<svg viewBox="0 0 100 100" class="motif" aria-hidden="true">${inner[motif] ?? inner.star}</svg>`;
}

export function artifactCardHtml(card: ArtifactCard): string {
  return `
    <article class="artifact-card" data-artifact="${card.id}">
      <div class="artifact-motif">${motifSvg(card.motif)}</div>
      <h3>${card.name}</h3>
      <p class="artifact-lore">${card.lore}</p>
      <p class="artifact-from">Wonder Artifact · ${card.id}</p>
      <div class="glint"></div>
    </article>`;
}

export function renderArtifactCabinet(
  root: HTMLElement,
  artifacts: readonly ArtifactCard[],
  chamberById: Map<string, ChamberSpec>,
  collected: ReadonlySet<string>
) {
  const cards = artifacts
    .map((card) => {
      if (collected.has(card.id)) return artifactCardHtml(card);
      const chamber = chamberById.get(card.chamberId);
      return `
        <article class="artifact-card silhouette" aria-label="Uncollected artifact">
          <div class="artifact-motif">${motifSvg(card.motif)}</div>
          <h3>· · ·</h3>
          <p class="artifact-lore">Sealed inside <strong>${chamber?.title ?? "a chamber"}</strong>. Solve its lock to pour the light.</p>
          <p class="artifact-from">Wonder Artifact · ${card.id}</p>
        </article>`;
    })
    .join("");
  root.innerHTML = `
    <section class="cabinet glass">
      <h2>The Artifact Cabinet</h2>
      <p class="map-sub">${collected.size} of ${artifacts.length} Wonder Artifacts gleam on the vellum.</p>
      <div class="cabinet-grid">${cards}</div>
    </section>`;
  root.querySelectorAll<HTMLElement>(".artifact-card:not(.silhouette)").forEach((el) => attachTilt(el));
}
