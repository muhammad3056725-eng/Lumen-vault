/**
 * The living background: slow liquid-brass caustics and drifting dust
 * motes over polished obsidian, with gentle pointer/scroll parallax.
 *
 *  - WebGL1 fragment shader, one full-screen triangle; Canvas2D fallback.
 *  - Device-pixel ratio is capped (≤ 2, and scaled down further for large
 *    screens) so the fill-rate stays small on phones and 4K alike.
 *  - Paused whenever the tab is hidden; a single still frame when the
 *    user prefers reduced motion.
 *  - Colours follow the active palette (read from CSS custom properties).
 */
import { prefersReducedMotion } from "../util.js";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPar;
uniform vec3 uBase;
uniform vec3 uBrass;
uniform vec3 uLumen;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float caustic(vec2 p, float t){
  vec2 i = p;
  float c = 1.0;
  float inten = 0.006;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 7.0);
}
float motes(vec2 uv, float scale, float t, float seed){
  vec2 g = uv * scale;
  g.y += t * 0.05 * (1.0 + seed);
  g.x += sin(t * 0.07 + g.y * 0.3) * 0.25;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(cell + seed * 17.0);
  if (h < 0.72) return 0.0;
  vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  float d = length(f - o * 0.7);
  float tw = 0.55 + 0.45 * sin(t * (0.6 + h) + h * 40.0);
  return smoothstep(0.08, 0.0, d) * tw;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  float t = uTime;
  // Obsidian: deep base with a faint vertical sheen.
  vec3 col = uBase * (0.85 + 0.3 * uv.y);
  // Pools of caustic light, masked by slow noise so they drift in and out.
  vec2 cp = q * 3.2 + uPar * 0.35;
  float c = caustic(mod(cp * 6.2831, 6.2831) - 250.0, t * 0.11);
  float mask = smoothstep(0.35, 0.85, noise(q * 1.6 + vec2(t * 0.015, -t * 0.01) + uPar * 0.2));
  col += uBrass * c * mask * 0.20;
  // Two warm glows that breathe.
  float g1 = exp(-6.0 * length(q - vec2(aspect * 0.82 + uPar.x * 0.05, 1.05)));
  float g2 = exp(-5.0 * length(q - vec2(-0.05, -0.05 + uPar.y * 0.05)));
  col += uBrass * g1 * (0.30 + 0.06 * sin(t * 0.3));
  col += uLumen * g2 * 0.12;
  // Dust motes at two depths (parallax).
  float m = motes(q + uPar * 0.6, 22.0, t, 0.0) * 0.55 + motes(q + uPar * 1.4, 11.0, t, 1.0) * 0.85;
  col += mix(uBrass, vec3(1.0, 0.95, 0.85), 0.4) * m * 0.55;
  // Vignette.
  float v = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= 0.55 + 0.45 * v;
  gl_FragColor = vec4(col, 1.0);
}`;

function cssColor(name: string, fallback: [number, number, number]): [number, number, number] {
  const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
  const m = raw.match(/^#([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class LivingBackground {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private start = performance.now();
  private par = { x: 0, y: 0, tx: 0, ty: 0 };
  private colors = { base: [0.04, 0.05, 0.08] as [number, number, number], brass: [0.9, 0.76, 0.48] as [number, number, number], lumen: [0.25, 0.88, 0.77] as [number, number, number] };
  private running = false;
  private still = prefersReducedMotion();

  constructor(host: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "living-bg";
    this.canvas.setAttribute("aria-hidden", "true");
    host.prepend(this.canvas);
    try {
      this.gl = this.canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) as WebGLRenderingContext | null;
    } catch {
      this.gl = null;
    }
    if (this.gl && !this.initGL(this.gl)) this.gl = null;
    if (!this.gl) this.ctx2d = this.canvas.getContext("2d");
    this.refreshPalette();
    this.resize();
    addEventListener("resize", () => this.resize());
    addEventListener("pointermove", (e) => {
      this.par.tx = (e.clientX / innerWidth - 0.5) * 0.6;
      this.par.ty = (e.clientY / innerHeight - 0.5) * -0.6;
    }, { passive: true });
    addEventListener("scroll", () => {
      this.par.ty = Math.min(1.5, scrollY / 1200);
    }, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? this.stop() : this.play()));
    matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => {
      this.still = e.matches;
      this.still ? this.stop() : this.play();
      this.frame(performance.now());
    });
    this.play();
    this.frame(performance.now());
  }

  private initGL(gl: WebGLRenderingContext): boolean {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const u of ["uRes", "uTime", "uPar", "uBase", "uBrass", "uLumen"]) this.uniforms[u] = gl.getUniformLocation(prog, u);
    return true;
  }

  /** Call after the palette changes. */
  refreshPalette() {
    this.colors.base = cssColor("--base", this.colors.base);
    this.colors.brass = cssColor("--brass", this.colors.brass);
    this.colors.lumen = cssColor("--lumen", this.colors.lumen);
    if (!this.running) this.frame(performance.now());
  }

  private resize() {
    const w = innerWidth;
    const h = innerHeight;
    // Cap DPR at 2, and keep the drawing buffer ≤ ~1.6 MP for fill-rate.
    let dpr = Math.min(devicePixelRatio || 1, 2);
    const budget = 1_600_000;
    if (w * h * dpr * dpr > budget) dpr = Math.sqrt(budget / (w * h));
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (!this.running) this.frame(performance.now());
  }

  private play() {
    if (this.running || this.still || document.hidden) return;
    this.running = true;
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop(now: number) {
    if (!this.running) return;
    this.frame(now);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private frame(now: number) {
    const t = this.still ? 12 : (now - this.start) / 1000;
    this.par.x += (this.par.tx - this.par.x) * 0.04;
    this.par.y += (this.par.ty - this.par.y) * 0.04;
    const gl = this.gl;
    if (gl) {
      gl.uniform2f(this.uniforms.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.uTime, t);
      gl.uniform2f(this.uniforms.uPar, this.par.x, this.par.y);
      gl.uniform3fv(this.uniforms.uBase, this.colors.base);
      gl.uniform3fv(this.uniforms.uBrass, this.colors.brass);
      gl.uniform3fv(this.uniforms.uLumen, this.colors.lumen);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    const c = this.ctx2d;
    if (!c) return;
    const { width: w, height: h } = this.canvas;
    const [br, bg, bb] = this.colors.base.map((v) => Math.round(v * 255));
    const [r, g, b] = this.colors.brass.map((v) => Math.round(v * 255));
    c.fillStyle = `rgb(${br},${bg},${bb})`;
    c.fillRect(0, 0, w, h);
    const glow = c.createRadialGradient(w * 0.85, -h * 0.05, 0, w * 0.85, -h * 0.05, Math.max(w, h) * 0.7);
    glow.addColorStop(0, `rgba(${r},${g},${b},0.22)`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const x = ((Math.sin(i * 91.7) * 0.5 + 0.5) * w + t * 6 * ((i % 3) + 1)) % w;
      const y = ((Math.cos(i * 37.3) * 0.5 + 0.5) * h - t * 9 * ((i % 2) + 1) + h * 4) % h;
      c.fillStyle = `rgba(${r},${g},${b},${0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t + i))})`;
      c.beginPath();
      c.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      c.fill();
    }
  }
}
