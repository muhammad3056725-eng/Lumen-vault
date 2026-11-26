/**
 * ConstellationMap (Blueprint §1/§2): a branching path of Vault
 * Chamber nodes joined by conduit paths. Solving a chamber pours
 * liquid-gold light along the conduit to the next node — rendered as
 * an animated stroke-dashoffset flow on the connecting path.
 */
import type { ChamberSpec } from "@lumen-vault/shared-types";
import type { VaultStorageDB } from "../engine/VaultStorageDB.js";

export interface MapOptions {
  title: string;
  subtitle: string;
  chamberIds: string[];
  chamberById: Map<string, ChamberSpec>;
  storage: VaultStorageDB;
  onOpen: (chamberId: string, index: number) => void;
}

const KIND_GLYPH: Record<ChamberSpec["kind"], string> = {
  venn: "◎",
  chrono: "⚙",
  forge: "◆",
  astrolabe: "✦",
};

export function nodePositions(count: number): { x: number; y: number }[] {
  const xs = [110, 300, 490, 300];
  return Array.from({ length: count }, (_, i) => ({
    x: xs[i % xs.length],
    y: 70 + i * 104,
  }));
}

export function renderConstellationMap(root: HTMLElement, opts: MapOptions) {
  const { chamberIds, chamberById, storage } = opts;
  const positions = nodePositions(chamberIds.length);
  const height = 140 + chamberIds.length * 104;
  const solved = chamberIds.map((id) => storage.isSolved(id));
  const unlocked = chamberIds.map((_, i) => i === 0 || solved[i] || solved[i - 1]);

  const paths = positions
    .slice(1)
    .map((p, i) => {
      const a = positions[i];
      const midY = (a.y + p.y) / 2;
      const d = `M ${a.x} ${a.y} C ${a.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      const flow = solved[i] && solved[i + 1];
      const lit = solved[i];
      return `<path d="${d}" class="conduit ${lit ? "lit" : ""} ${flow ? "flow" : ""}" />`;
    })
    .join("");

  const nodes = chamberIds
    .map((id, i) => {
      const spec = chamberById.get(id)!;
      const p = positions[i];
      const state = solved[i] ? "solved" : unlocked[i] ? "open" : "locked";
      return `
        <g class="node ${state}" data-chamber="${id}" transform="translate(${p.x}, ${p.y})" role="button" aria-label="${spec.title}">
          <circle r="26" class="node-ring" />
          <circle r="19" class="node-core" />
          <text class="node-glyph" y="7">${KIND_GLYPH[spec.kind]}</text>
          <text class="node-label" y="48">${spec.title}</text>
          <text class="node-state" y="64">${solved[i] ? "Unsealed" : unlocked[i] ? "Awaiting" : "Sealed"}</text>
        </g>`;
    })
    .join("");

  root.innerHTML = `
    <section class="map-wrap glass">
      <h2>${opts.title}</h2>
      <p class="map-sub">${opts.subtitle}</p>
      <svg class="constellation" viewBox="0 0 600 ${height}" preserveAspectRatio="xMidYMin meet" aria-label="Constellation map">
        ${paths}
        ${nodes}
      </svg>
    </section>`;

  root.querySelectorAll<SVGGElement>(".node").forEach((g, i) => {
    if (!unlocked[i]) return;
    g.classList.add("clickable");
    g.addEventListener("click", () => opts.onOpen(chamberIds[i], i));
  });
}
