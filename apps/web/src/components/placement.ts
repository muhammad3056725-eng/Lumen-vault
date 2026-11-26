/**
 * Universal tile placement — one controller for every drag-and-drop lock.
 *
 *  - Pointer drag (mouse, pen, touch): a floating ghost follows the
 *    pointer, the nearest zone within ONE magnet radius glows, and a drop
 *    there snaps the tile home; anywhere else it glides back. Moves are
 *    animated with FLIP on the vault spring, measured from where the tile
 *    really was, so nothing jumps.
 *  - Tap-to-select, then tap-to-place: tap a tile (or press Enter/Space
 *    on it), then tap or press Enter on a socket, slot, ledger row or the
 *    tray. This is also the keyboard mode. Escape cancels.
 *  - Capacity-1 zones (gear slots) swap their occupant back to where the
 *    incoming tile came from; open zones hold any number of tiles.
 *  - The tray is a drop target too, so any tile can be taken back.
 *  - Edge auto-scroll while dragging, for phones where the board and the
 *    tray are not on screen together. In-flight springs are cancelled
 *    whenever a tile is grabbed again.
 */
import { springTo, DRAG_ELEVATION_SCALE } from "../engine/SpringPhysics.js";
import type { AsmrAudioEngine } from "../engine/AsmrAudioEngine.js";
import { prefersReducedMotion } from "../util.js";

export const MAGNET_RADIUS = 44; // px from a zone's edge — used for both glow and snap

export interface Zone {
  key: string;
  label: string;
  /** Where tiles live. */
  container: HTMLElement;
  /** Elements that accept drops and taps (buttons / role=button). */
  hits: HTMLElement[];
  capacity: number;
}

export interface PlacementOptions {
  tiles: HTMLElement[];
  zones: Zone[];
  audio: AsmrAudioEngine;
  onChange: () => void;
  announce: (text: string) => void;
  nameOf: (tile: HTMLElement) => string;
}

export class Placement {
  private opts: PlacementOptions;
  private selected: HTMLElement | null = null;
  private springs = new WeakMap<HTMLElement, () => void>();
  private suppressClick = new WeakSet<HTMLElement>();
  private cleanup: (() => void)[] = [];

  constructor(opts: PlacementOptions) {
    this.opts = opts;
    for (const tile of opts.tiles) this.wireTile(tile);
    for (const zone of opts.zones) for (const hit of zone.hits) this.wireHit(zone, hit);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.selected) this.deselect(true);
    };
    document.addEventListener("keydown", onKey);
    this.cleanup.push(() => document.removeEventListener("keydown", onKey));
  }

  destroy() {
    this.cleanup.forEach((f) => f());
  }

  zoneOf(tile: HTMLElement): Zone | undefined {
    return this.opts.zones.find((z) => z.container.contains(tile));
  }

  zoneByKey(key: string): Zone {
    const z = this.opts.zones.find((x) => x.key === key);
    if (!z) throw new Error(`No zone ${key}`);
    return z;
  }

  tilesIn(zone: Zone): HTMLElement[] {
    return [...zone.container.querySelectorAll<HTMLElement>(".tile")];
  }

  /* ---------------- moves ---------------- */

  /** Move a tile into a zone (FLIP-animated). Handles capacity-1 swaps. */
  move(tile: HTMLElement, zone: Zone, fromRect?: DOMRect) {
    const source = this.zoneOf(tile);
    if (source === zone) {
      this.flipFrom(tile, fromRect ?? tile.getBoundingClientRect(), () => {});
      return;
    }
    const occupants = this.tilesIn(zone).filter((t) => t !== tile);
    const firstRect = fromRect ?? tile.getBoundingClientRect();
    let displaced: { el: HTMLElement; rect: DOMRect } | null = null;
    if (occupants.length >= zone.capacity && source) {
      const el = occupants[0];
      displaced = { el, rect: el.getBoundingClientRect() };
    }
    this.flipFrom(tile, firstRect, () => zone.container.appendChild(tile));
    if (displaced && source) {
      const d = displaced;
      this.flipFrom(d.el, d.rect, () => source.container.appendChild(d.el));
    }
    this.opts.audio.brassClick();
    this.opts.onChange();
  }

  /** Spring-animate `tile` from `first` to wherever `mutate` puts it. */
  private flipFrom(tile: HTMLElement, first: DOMRect, mutate: () => void) {
    this.springs.get(tile)?.();
    tile.style.transform = "";
    mutate();
    if (prefersReducedMotion()) return;
    const last = tile.getBoundingClientRect();
    const dx = first.left + first.width / 2 - (last.left + last.width / 2);
    const dy = first.top + first.height / 2 - (last.top + last.height / 2);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    const cancel = springTo(tile, { x: dx, y: dy }, { x: 0, y: 0 }, () => {
      tile.style.transform = "";
      this.springs.delete(tile);
    });
    this.springs.set(tile, cancel);
  }

  /* ---------------- selection (tap & keyboard) ---------------- */

  private select(tile: HTMLElement) {
    if (this.selected) this.selected.classList.remove("selected");
    this.selected = tile;
    tile.classList.add("selected");
    tile.setAttribute("aria-pressed", "true");
    document.body.classList.add("placing");
    for (const z of this.opts.zones) for (const h of z.hits) h.classList.toggle("targetable", !z.container.contains(tile));
    this.opts.audio.brassClick();
    this.opts.announce(`${this.opts.nameOf(tile)} lifted. Choose where to place it, or press Escape.`);
  }

  private deselect(announce = false) {
    if (!this.selected) return;
    this.selected.classList.remove("selected");
    this.selected.setAttribute("aria-pressed", "false");
    if (announce) this.opts.announce(`${this.opts.nameOf(this.selected)} set down where it was.`);
    this.selected = null;
    document.body.classList.remove("placing");
    for (const z of this.opts.zones) for (const h of z.hits) h.classList.remove("targetable");
  }

  private placeSelected(zone: Zone) {
    const tile = this.selected;
    if (!tile) return;
    this.deselect();
    this.move(tile, zone);
    this.opts.announce(`${this.opts.nameOf(tile)} placed in ${zone.label}.`);
    tile.focus({ preventScroll: true });
  }

  private wireHit(zone: Zone, hit: HTMLElement) {
    const activate = (e: Event) => {
      if (!this.selected) return;
      if ((e.target as HTMLElement).closest(".tile") && hit !== e.target) return; // tile click handles itself
      e.preventDefault();
      this.placeSelected(zone);
    };
    hit.addEventListener("click", activate);
    hit.addEventListener("keydown", (e) => {
      if (e.target !== hit) return;
      if (e.key === "Enter" || e.key === " ") activate(e);
    });
  }

  /* ---------------- pointer drag ---------------- */

  private wireTile(tile: HTMLElement) {
    tile.setAttribute("aria-pressed", "false");
    tile.style.touchAction = "none";

    tile.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.suppressClick.has(tile)) {
        this.suppressClick.delete(tile);
        return;
      }
      if (this.selected === tile) {
        this.deselect(true);
        return;
      }
      if (this.selected) {
        const zone = this.zoneOf(tile);
        const selZone = this.zoneOf(this.selected);
        if (zone && zone !== selZone && zone.capacity === 1) {
          this.placeSelected(zone);
          return;
        }
        if (zone && zone !== selZone && zone.capacity > 1) {
          this.placeSelected(zone);
          return;
        }
      }
      this.select(tile);
    });

    tile.addEventListener("pointerdown", (down) => {
      if (down.button !== 0) return;
      const startX = down.clientX;
      const startY = down.clientY;
      let ghost: HTMLElement | null = null;
      let magnet: Zone | null = null;
      let lastX = startX;
      let lastY = startY;
      let lastT = performance.now();
      let pointerY = startY;
      let scrollRaf = 0;
      let grabDX = 0;
      let grabDY = 0;
      tile.setPointerCapture?.(down.pointerId);

      const highlight = (z: Zone | null) => {
        if (magnet === z) return;
        magnet?.hits.forEach((h) => h.classList.remove("magnet"));
        magnet = z;
        magnet?.hits.forEach((h) => h.classList.add("magnet"));
      };

      const nearest = (): Zone | null => {
        if (!ghost) return null;
        const r = ghost.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let best: { z: Zone; d: number } | null = null;
        for (const z of this.opts.zones) {
          for (const h of z.hits) {
            const hr = h.getBoundingClientRect();
            if (hr.width === 0 && hr.height === 0) continue;
            const dx = Math.max(hr.left - cx, 0, cx - hr.right);
            const dy = Math.max(hr.top - cy, 0, cy - hr.bottom);
            const d = Math.hypot(dx, dy);
            if (d <= MAGNET_RADIUS && (!best || d < best.d)) best = { z, d };
          }
        }
        return best?.z ?? null;
      };

      const autoScroll = () => {
        const edge = 72;
        let dy = 0;
        if (pointerY < edge) dy = -Math.ceil((edge - pointerY) / 6);
        else if (pointerY > innerHeight - edge) dy = Math.ceil((pointerY - (innerHeight - edge)) / 6);
        if (dy !== 0) {
          scrollBy(0, dy);
          highlight(nearest());
        }
        scrollRaf = requestAnimationFrame(autoScroll);
      };

      const beginDrag = () => {
        this.springs.get(tile)?.();
        tile.style.transform = "";
        if (this.selected) this.deselect();
        const r = tile.getBoundingClientRect();
        grabDX = startX - r.left;
        grabDY = startY - r.top;
        ghost = tile.cloneNode(true) as HTMLElement;
        ghost.classList.add("tile-ghost");
        ghost.removeAttribute("id");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = `${r.width}px`;
        ghost.style.height = `${r.height}px`;
        ghost.style.left = `${r.left}px`;
        ghost.style.top = `${r.top}px`;
        document.body.appendChild(ghost);
        tile.classList.add("drag-source");
        document.body.classList.add("dragging");
        this.opts.audio.paperStart();
        scrollRaf = requestAnimationFrame(autoScroll);
      };

      const onMove = (e: PointerEvent) => {
        if (e.pointerId !== down.pointerId) return;
        pointerY = e.clientY;
        if (!ghost) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) < 7) return;
          beginDrag();
        }
        e.preventDefault();
        ghost!.style.transform = `translate3d(${e.clientX - grabDX - parseFloat(ghost!.style.left)}px, ${e.clientY - grabDY - parseFloat(ghost!.style.top)}px, 0) scale(${DRAG_ELEVATION_SCALE}) rotate(-1.5deg)`;
        const now = performance.now();
        const v = Math.hypot(e.clientX - lastX, e.clientY - lastY) / Math.max(0.001, (now - lastT) / 1000);
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
        this.opts.audio.paperMove(v);
        highlight(nearest());
      };

      const finish = (e: PointerEvent, commit: boolean) => {
        if (e.pointerId !== down.pointerId) return;
        tile.removeEventListener("pointermove", onMove);
        tile.removeEventListener("pointerup", onUp);
        tile.removeEventListener("pointercancel", onCancel);
        tile.removeEventListener("lostpointercapture", onLost);
        cancelAnimationFrame(scrollRaf);
        if (!ghost) return; // a tap — the click handler takes over
        this.suppressClick.add(tile);
        setTimeout(() => this.suppressClick.delete(tile), 0);
        const target = commit ? nearest() : null;
        highlight(null);
        const ghostRect = ghost.getBoundingClientRect();
        ghost.remove();
        tile.classList.remove("drag-source");
        document.body.classList.remove("dragging");
        this.opts.audio.paperStop();
        if (target) {
          this.move(tile, target, ghostRect);
          this.opts.announce(`${this.opts.nameOf(tile)} placed in ${target.label}.`);
        } else {
          this.flipFrom(tile, ghostRect, () => {});
        }
      };
      const onUp = (e: PointerEvent) => finish(e, true);
      const onCancel = (e: PointerEvent) => finish(e, false);
      const onLost = (e: PointerEvent) => finish(e, true);
      tile.addEventListener("pointermove", onMove);
      tile.addEventListener("pointerup", onUp);
      tile.addEventListener("pointercancel", onCancel);
      tile.addEventListener("lostpointercapture", onLost);
    });
  }

  /** Programmatic placement used by Insight Prism hints. */
  place(tile: HTMLElement, zoneKey: string) {
    this.move(tile, this.zoneByKey(zoneKey));
  }
}
