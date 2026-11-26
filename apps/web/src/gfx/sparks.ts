/**
 * Gold-spark particle burst for the unseal sequence. A temporary
 * full-screen canvas (DPR ≤ 2) that removes itself when the sparks fade.
 * Skipped entirely under prefers-reduced-motion.
 */
import { prefersReducedMotion } from "../util.js";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
}

export function sparkBurst(x: number, y: number, count = 90, color = "#e5c17b") {
  if (prefersReducedMotion() || typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.className = "spark-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);
  const sparks: Spark[] = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 380;
    return {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 120,
      life: 0,
      max: 0.9 + Math.random() * 0.9,
      size: 1 + Math.random() * 2.6,
      hue: Math.random(),
    };
  });
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    let alive = 0;
    for (const p of sparks) {
      p.life += dt;
      if (p.life >= p.max) continue;
      alive++;
      p.vy += 260 * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.hue > 0.85 ? "#fff6dc" : color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2);
      ctx.fill();
    }
    if (alive > 0) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
