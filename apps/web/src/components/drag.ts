/**
 * Universal pointer drag (Blueprint H4, M2, §3): unified Pointer
 * Events with touch-action: none — identical behaviour for touch,
 * trackpad and mouse from 360px to 4K. Dragged tiles scale to 1.04
 * elevation; sockets inside the magnetic threshold glow, and a drop
 * near a socket springs the tile home (stiffness 290, damping 24);
 * a drop anywhere else glides the tile back on the same spring.
 */
import { MAGNETIC_SNAP_PX, DRAG_ELEVATION_SCALE, springTo } from "../engine/SpringPhysics.js";
import type { AsmrAudioEngine } from "../engine/AsmrAudioEngine.js";

export interface DragTarget {
  el: HTMLElement;
  key: string;
  occupied: () => boolean;
}

export interface DragOptions {
  targets: () => DragTarget[];
  onSnap: (key: string) => void;
  onUnsnap: () => void;
  audio: AsmrAudioEngine;
}

const SNAP_RADIUS = 84; // px from socket centre (socket radius + M2's 28px magnet band)

export function attachDrag(tile: HTMLElement, opts: DragOptions) {
  tile.classList.add("draggable");
  tile.style.touchAction = "none";
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let dragging = false;
  let magnet: HTMLElement | null = null;

  const clearMagnet = () => {
    magnet?.classList.remove("magnet");
    magnet = null;
  };

  tile.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    tile.setPointerCapture(ev.pointerId);
    dragging = true;
    startX = lastX = ev.clientX;
    startY = lastY = ev.clientY;
    lastT = performance.now();
    tile.classList.add("dragging");
    tile.style.transform = `translate3d(0,0,0) scale(${DRAG_ELEVATION_SCALE})`;
    tile.style.zIndex = "40";
    opts.audio.paperStart();
  });

  tile.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    tile.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${DRAG_ELEVATION_SCALE})`;
    const now = performance.now();
    const dt = Math.max(1, now - lastT) / 1000;
    const velocity = Math.hypot(ev.clientX - lastX, ev.clientY - lastY) / dt;
    lastX = ev.clientX;
    lastY = ev.clientY;
    lastT = now;
    opts.audio.paperMove(velocity);
    // Magnetic highlight: nearest unoccupied target within reach.
    clearMagnet();
    const tileRect = tile.getBoundingClientRect();
    const cx = tileRect.left + tileRect.width / 2;
    const cy = tileRect.top + tileRect.height / 2;
    let best: { el: HTMLElement; d: number } | null = null;
    for (const t of opts.targets()) {
      if (t.occupied()) continue;
      const r = t.el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (d <= SNAP_RADIUS + MAGNETIC_SNAP_PX && (best === null || d < best.d)) best = { el: t.el, d };
    }
    if (best) {
      magnet = best.el;
      magnet.classList.add("magnet");
    }
  });

  const finish = (ev: PointerEvent, commit: boolean) => {
    if (!dragging) return;
    dragging = false;
    tile.classList.remove("dragging");
    opts.audio.paperStop();
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    let snapped: DragTarget | null = null;
    if (commit) {
      const tileRect = tile.getBoundingClientRect();
      const cx = tileRect.left + tileRect.width / 2;
      const cy = tileRect.top + tileRect.height / 2;
      let bestD = Infinity;
      for (const t of opts.targets()) {
        if (t.occupied()) continue;
        const r = t.el.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
        if (d < bestD) {
          bestD = d;
          snapped = t;
        }
      }
      if (snapped && bestD > SNAP_RADIUS) snapped = null;
    }
    clearMagnet();
    tile.style.zIndex = "";
    if (snapped) {
      // Reparent into the socket, then spring the last offset away.
      const target = snapped;
      target.el.appendChild(tile);
      tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      requestAnimationFrame(() => {
        springTo(tile, { x: dx, y: dy }, { x: 0, y: 0 }, () => {
          tile.style.transform = "";
        });
      });
      opts.audio.brassClick();
      opts.onSnap(target.key);
    } else {
      springTo(tile, { x: dx, y: dy }, { x: 0, y: 0 }, () => {
        tile.style.transform = "";
      });
      opts.onUnsnap();
    }
  };

  tile.addEventListener("pointerup", (ev) => finish(ev, true));
  tile.addEventListener("pointercancel", (ev) => finish(ev, false));
}

/** 2.5D card tilt with specular glint (Blueprint §3: ±8° max). */
export function attachTilt(el: HTMLElement, maxDeg = 8) {
  el.addEventListener("pointermove", (ev) => {
    const r = el.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width;
    const py = (ev.clientY - r.top) / r.height;
    const rx = (0.5 - py) * 2 * maxDeg;
    const ry = (px - 0.5) * 2 * maxDeg;
    el.style.transform = `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    el.style.setProperty("--glint-x", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--glint-y", `${(py * 100).toFixed(1)}%`);
  });
  el.addEventListener("pointerleave", () => {
    el.style.transform = "";
  });
}
