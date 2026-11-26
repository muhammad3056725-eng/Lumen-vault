/**
 * AsmrAudioEngine (Blueprint §3, M5): every sound is synthesized in
 * real time with the Web Audio API — zero audio assets.
 *  - Vellum paper friction: white noise through a band-pass filter
 *    (Q = 3.5, 800→2200 Hz swept by pointer velocity).
 *  - Brass tumbler click: dual oscillator (Square 120 Hz + Sine
 *    2400 Hz, 15 ms exponential decay).
 *  - Chamber unseal chime: arpeggiated F#4 A#4 C#5 F5 G#5 through a
 *    multi-tap delay and a generated-impulse convolver reverb.
 * Peak gain is capped at 0.22 (M5); envelopes run 120–450 ms.
 */
export const MAX_GAIN = 0.22;

export class AsmrAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private paperNodes: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  muted = false;

  /** Must be called from a user gesture at least once. */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MAX_GAIN;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : MAX_GAIN, this.ctx.currentTime, 0.02);
    }
  }

  /** Start/refresh the paper-friction loop while a tile is dragged. */
  paperStart() {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer || this.paperNodes) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 3.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.paperNodes = { src, filter, gain };
  }

  /** Modulate the paper filter with pointer velocity (800→2200 Hz). */
  paperMove(velocityPxPerSec: number) {
    if (!this.ctx || !this.paperNodes) return;
    const t = this.ctx.currentTime;
    const freq = 800 + Math.min(1, Math.abs(velocityPxPerSec) / 1600) * 1400;
    this.paperNodes.filter.frequency.setTargetAtTime(freq, t, 0.03);
    this.paperNodes.gain.gain.setTargetAtTime(0.5, t, 0.03);
  }

  paperStop() {
    if (!this.ctx || !this.paperNodes) return;
    const { src, gain } = this.paperNodes;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    const stopAt = this.ctx.currentTime + 0.2;
    try {
      src.stop(stopAt);
    } catch {
      /* already stopped */
    }
    this.paperNodes = null;
  }

  /** Brass tumbler click: Square 120 Hz + Sine 2400 Hz, 15 ms decay. */
  brassClick() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const mk = (type: OscillatorType, freq: number, peak: number) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.13);
    };
    mk("square", 120, 0.5);
    mk("sine", 2400, 0.35);
  }

  /** A soft, kind nudge tone — never a buzzer (no fail screens, §1). */
  nudge() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(392, t);
    osc.frequency.setTargetAtTime(330, t + 0.05, 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Liquid-gold pour: a rising filtered sweep as light fills a node. */
  goldPour() {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.5);
  }

  /** Unseal chime: F#4 A#4 C#5 F5 G#5 arpeggio + delay + reverb. */
  unsealChime() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const notes = [370.0, 466.16, 554.37, 698.46, 830.61]; // F#4 A#4 C#5 F5 G#5
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.16;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.25;
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(1.4, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(delayGain).connect(delay);
    delay.connect(this.master);
    convolver.connect(wet).connect(this.master);
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g);
      g.connect(this.master!);
      g.connect(delay);
      g.connect(convolver);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  private impulse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }
}
