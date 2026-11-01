/** Tiny synthesised sound effects, so the game needs no audio files. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  /** Must be called from a user gesture. */
  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const len = this.ctx.sampleRate * 0.4;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
  }

  private tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, cutoff: number, gain = 1): void {
    const c = this.ctx;
    if (!c || !this.noise) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(vol * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shot(volume = 1): void {
    this.burst(0.18, 0.5, 2400, volume);
    this.tone(180, 50, 0.12, "square", 0.25 * volume);
  }
  hit(): void {
    this.tone(1300, 900, 0.05, "square", 0.12);
  }
  kill(): void {
    this.tone(900, 1800, 0.12, "triangle", 0.18);
  }
  hurt(): void {
    this.tone(160, 70, 0.18, "sawtooth", 0.22);
  }
  empty(): void {
    this.tone(500, 400, 0.04, "square", 0.1);
  }
  reload(): void {
    this.tone(300, 500, 0.06, "square", 0.1);
    this.tone(500, 800, 0.06, "square", 0.1, 0.35);
  }
  beep(i: number): void {
    this.tone([440, 554, 659][i % 3], [440, 554, 659][i % 3], 0.28, "sine", 0.2);
  }
  bad(): void {
    this.tone(140, 90, 0.35, "sawtooth", 0.2);
  }
  good(): void {
    this.tone(523, 523, 0.12, "triangle", 0.2);
    this.tone(784, 784, 0.25, "triangle", 0.2, 0.12);
  }
}
