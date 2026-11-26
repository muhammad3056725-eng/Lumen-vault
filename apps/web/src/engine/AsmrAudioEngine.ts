/**
 * AsmrAudioEngine: every sound is synthesized with the Web Audio API —
 * zero audio assets.
 *  - Vellum paper friction: looped noise through a band-pass filter
 *    (Q 3.5, 800→2200 Hz swept by pointer velocity).
 *  - Brass tumbler click: square 120 Hz + sine 2400 Hz, fast decay.
 *  - Unseal chime: F#4 A#4 C#5 F5 G#5 arpeggio through a short delay and a
 *    convolver reverb. The impulse response is generated ONCE and cached;
 *    every per-chime node is disconnected when its tail has rung out.
 * Peak gain is capped at 0.22.
 */
export const MAX_GAIN = 0.22;

export class AsmrAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private impulseBuffer: AudioBuffer | null = null;
  private paperNodes: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  muted = false;

  /** Must be called from a user gesture at least once. */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
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
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : MAX_GAIN, this.ctx.currentTime, 0.02);
  }

  private quiet(): boolean {
    return this.muted;
  }

  paperStart() {
    if (this.quiet()) return;
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

  paperMove(velocityPxPerSec: number) {
    if (!this.ctx || !this.paperNodes) return;
    const t = this.ctx.currentTime;
    const freq = 800 + Math.min(1, Math.abs(velocityPxPerSec) / 1600) * 1400;
    this.paperNodes.filter.frequency.setTargetAtTime(freq, t, 0.03);
    this.paperNodes.gain.gain.setTargetAtTime(Math.min(0.5, 0.15 + velocityPxPerSec / 3000), t, 0.03);
  }

  paperStop() {
    if (!this.ctx || !this.paperNodes) return;
    const { src, gain, filter } = this.paperNodes;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    try {
      src.stop(this.ctx.currentTime + 0.25);
    } catch {
      /* already stopped */
    }
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.paperNodes = null;
  }

  brassClick() {
    if (this.quiet()) return;
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
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    };
    mk("square", 120, 0.45);
    mk("sine", 2400, 0.3);
  }

  /** A soft, kind nudge tone — never a buzzer. */
  nudge() {
    if (this.quiet()) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(392, t);
    osc.frequency.setTargetAtTime(330, t + 0.05, 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  /** Liquid-gold pour: a rising filtered sweep as light fills a node. */
  goldPour(duration = 0.45) {
    if (this.quiet()) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  unsealChime() {
    if (this.quiet()) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const notes = [370.0, 466.16, 554.37, 698.46, 830.61]; // F#4 A#4 C#5 F5 G#5
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.16;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse();
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback).connect(delay);
    delay.connect(this.master);
    convolver.connect(wet).connect(this.master);
    const nodes: AudioNode[] = [delay, feedback, convolver, wet];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g);
      g.connect(this.master!);
      g.connect(delay);
      g.connect(convolver);
      osc.start(t);
      osc.stop(t + 0.5);
      nodes.push(osc, g);
    });
    // Disconnect the whole voice once the reverb and echoes have faded.
    setTimeout(() => nodes.forEach((n) => n.disconnect()), 3200);
  }

  private impulse(): AudioBuffer {
    if (this.impulseBuffer) return this.impulseBuffer;
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * 1.4);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
    }
    this.impulseBuffer = buffer;
    return buffer;
  }
}
