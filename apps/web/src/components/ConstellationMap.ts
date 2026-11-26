/**
 * The constellation: a vertical, phone-first path of chamber medallions
 * joined by brass conduits. Labels are real HTML (readable at any width);
 * the conduits are an SVG layer measured from the live layout and redrawn
 * on resize. When a chamber has just been solved, liquid gold literally
 * pours down its conduit to wake the next node.
 */
import type { ChamberSpec } from "@lumen-vault/shared-types";
import { kindIcon } from "../gfx/defs.js";
import { esc, prefersReducedMotion } from "../util.js";
import { KIND_LABEL } from "./chambers/index.js";

export interface MapNodeState {
  id: string;
  solved: boolean;
  unlocked: boolean;
  stars: number;
}

export interface MapOptions {
  title: string;
  subtitle: string;
  progressLabel: string;
  nodes: MapNodeState[];
  chamberById: Map<string, ChamberSpec>;
  /** Chamber id whose outgoing conduit should pour now (just solved). */
  pourFrom?: string;
  onOpen: (chamberId: string) => void;
  onPour?: () => void;
}

function medallion(kind: ChamberSpec["kind"]): string {
  return `
    <svg viewBox="0 0 100 100" class="medal" aria-hidden="true">
      <circle cx="50" cy="50" r="47" class="medal-halo" />
      <circle cx="50" cy="50" r="42" fill="url(#lv-brass)" class="medal-rim" />
      <circle cx="50" cy="50" r="35" class="medal-core" />
      <circle cx="50" cy="50" r="35" fill="url(#lv-spec)" opacity="0.35" />
    </svg>
    ${kindIcon(kind, "medal-glyph")}`;
}

export function renderConstellationMap(root: HTMLElement, opts: MapOptions): () => void {
  const items = opts.nodes
    .map((n, i) => {
      const spec = opts.chamberById.get(n.id)!;
      const state = n.solved ? "solved" : n.unlocked ? "open" : "locked";
      const stars = n.solved ? `<span class="node-stars" aria-label="${n.stars} of 3 stars">${"★".repeat(n.stars)}${"☆".repeat(3 - n.stars)}</span>` : "";
      return `
        <li class="node-wrap ${i % 2 ? "right" : "left"} ${state}" data-index="${i}">
          <button type="button" class="node ${state}" data-chamber="${n.id}" ${n.unlocked ? "" : 'aria-disabled="true"'}
            aria-label="${esc(spec.title)} — ${KIND_LABEL[spec.kind]} — ${n.solved ? "unsealed" : n.unlocked ? "awaiting" : "sealed: solve the previous chamber first"}">
            <span class="medal-wrap">${medallion(spec.kind)}</span>
            <span class="node-text">
              <span class="node-kind">${KIND_LABEL[spec.kind]}</span>
              <span class="node-title">${esc(spec.title)}</span>
              <span class="node-state">${n.solved ? "Unsealed" : n.unlocked ? "Awaiting" : "Sealed"} ${stars}</span>
            </span>
          </button>
        </li>`;
    })
    .join("");

  root.innerHTML = `
    <section class="map-wrap panel">
      <header class="map-head">
        <h2>${esc(opts.title)}</h2>
        <p class="map-sub">${esc(opts.subtitle)}</p>
        <p class="map-progress">${esc(opts.progressLabel)}</p>
      </header>
      <div class="path">
        <svg class="conduits" aria-hidden="true"></svg>
        <ol class="nodes">${items}</ol>
      </div>
    </section>`;

  const path = root.querySelector<HTMLElement>(".path")!;
  const svg = root.querySelector<SVGSVGElement>(".conduits")!;
  const nodeEls = [...root.querySelectorAll<HTMLElement>(".node")];
  nodeEls.forEach((el, i) =>
    el.addEventListener("click", () => {
      if (!opts.nodes[i].unlocked) {
        el.classList.remove("shake");
        void el.offsetWidth;
        el.classList.add("shake");
        return;
      }
      opts.onOpen(opts.nodes[i].id);
    })
  );

  const pourIndex = opts.pourFrom ? opts.nodes.findIndex((n) => n.id === opts.pourFrom) : -1;
  let pourDone = pourIndex < 0 || pourIndex >= opts.nodes.length - 1;

  const draw = () => {
    const box = path.getBoundingClientRect();
    if (box.width === 0) return;
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    svg.setAttribute("width", String(box.width));
    svg.setAttribute("height", String(box.height));
    const centers = nodeEls.map((el) => {
      const r = el.querySelector(".medal-wrap")!.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    let html = "";
    for (let i = 0; i < centers.length - 1; i++) {
      const a = centers[i];
      const b = centers[i + 1];
      const my = (a.y + b.y) / 2;
      const d = `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
      const lit = opts.nodes[i].solved && (pourDone || i !== pourIndex);
      const flow = lit && opts.nodes[i + 1].solved;
      html += `<path d="${d}" class="conduit-base" />`;
      if (lit) html += `<path d="${d}" class="conduit-lit ${flow ? "flow" : ""}" />`;
      if (i === pourIndex && !pourDone) html += `<path d="${d}" class="conduit-pour" data-pour="1" /><circle r="6" class="pour-bead" />`;
    }
    svg.innerHTML = html;
  };

  const pour = () => {
    const p = svg.querySelector<SVGPathElement>("[data-pour]");
    const bead = svg.querySelector<SVGCircleElement>(".pour-bead");
    const next = nodeEls[pourIndex + 1];
    const finish = () => {
      pourDone = true;
      next?.classList.add("awaken");
      opts.onPour?.();
      draw();
    };
    if (!p || prefersReducedMotion()) {
      finish();
      return;
    }
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    const start = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      p.style.strokeDashoffset = `${len * (1 - e)}`;
      const pt = p.getPointAtLength(len * e);
      bead?.setAttribute("cx", String(pt.x));
      bead?.setAttribute("cy", String(pt.y));
      if (k < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  };

  draw();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => draw()) : null;
  ro?.observe(path);
  if (!pourDone) setTimeout(pour, 350);
  // Bring the next open node into view on small screens.
  const focusIdx = opts.nodes.findIndex((n) => n.unlocked && !n.solved);
  if (focusIdx > 1) nodeEls[focusIdx]?.scrollIntoView?.({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  return () => ro?.disconnect();
}
