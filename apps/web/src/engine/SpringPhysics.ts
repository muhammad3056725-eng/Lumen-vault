/**
 * SpringPhysics (Blueprint §3, M2, H5).
 * Standard vault spring: stiffness 290, damping 24, mass 1.0.
 * Force = -stiffness * (pos - target) - damping * velocity.
 * Delta-time is clamped (dt = min(rawDt, 0.05)) so tab-switching can
 * never destabilise the simulation (H5).
 */
export const SPRING_STIFFNESS = 290;
export const SPRING_DAMPING = 24;
export const SPRING_MASS = 1.0;
export const MAGNETIC_SNAP_PX = 28; // M2 magnetic snap distance
export const DRAG_ELEVATION_SCALE = 1.04; // M2 drag elevation

export function clampDt(rawDt: number): number {
  return Math.min(rawDt, 0.05);
}

export class SpringValue {
  x: number;
  v = 0;
  constructor(initial: number) {
    this.x = initial;
  }
  /** Advance one frame toward `target`; returns true when settled. */
  step(target: number, rawDt: number): boolean {
    const dt = clampDt(rawDt);
    const force = -SPRING_STIFFNESS * (this.x - target) - SPRING_DAMPING * this.v;
    const accel = force / SPRING_MASS;
    this.v += accel * dt;
    this.x += this.v * dt;
    return Math.abs(this.x - target) < 0.1 && Math.abs(this.v) < 1;
  }
}

/** A 2D spring-driven point, used for tile glide-back and snap-in. */
export class SpringPoint {
  readonly sx: SpringValue;
  readonly sy: SpringValue;
  constructor(x: number, y: number) {
    this.sx = new SpringValue(x);
    this.sy = new SpringValue(y);
  }
  get x() {
    return this.sx.x;
  }
  get y() {
    return this.sy.x;
  }
  step(tx: number, ty: number, rawDt: number): boolean {
    const ax = this.sx.step(tx, rawDt);
    const ay = this.sy.step(ty, rawDt);
    return ax && ay;
  }
}

/**
 * Animate an element's transform from its current offset to (tx, ty)
 * with the vault spring; calls `onDone` when settled. Returns a cancel
 * function. Uses transform translate3d — no layout thrash.
 */
export function springTo(
  el: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onDone?: () => void
): () => void {
  const point = new SpringPoint(from.x, from.y);
  let raf = 0;
  let last = performance.now();
  let cancelled = false;
  const frame = (now: number) => {
    if (cancelled) return;
    const dt = (now - last) / 1000;
    last = now;
    const settled = point.step(to.x, to.y, dt);
    el.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    if (settled) {
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
