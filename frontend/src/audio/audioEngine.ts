import { useSettingsStore } from "../store/settingsStore";

export type SfxName =
  | "click"
  | "confirm"
  | "error"
  | "good"
  | "info"
  | "warning"
  | "crisis"
  | "decision"
  | "war"
  | "victory"
  | "defeat"
  | "intro";

export type Mood = "menu" | "calm" | "tense";

const midi = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

// Chords as MIDI note numbers
const CALM_CHORDS = [
  [50, 57, 62, 65],
  [46, 53, 58, 62],
  [43, 50, 55, 58],
  [45, 52, 57, 60],
];
const TENSE_CHORDS = [
  [38, 45, 50],
  [41, 48, 53],
  [37, 44, 49],
  [40, 47, 52],
];
const PENTATONIC = [62, 65, 67, 69, 72, 74];
const TENSE_LEAD = [74, 75, 77, 70];

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  slideTo?: number;
  bus?: AudioNode;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicOn = false;
  private mood: Mood = "menu";
  private chordIndex = 0;

  isUnlocked(): boolean {
    return this.ctx !== null;
  }

  /** Browsers only allow audio after a user gesture, so this is called from the first click or key press. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.connect(ctx.destination);

      const sfxBus = ctx.createGain();
      sfxBus.connect(master);

      // Music goes through a soft echo for atmosphere
      const musicBus = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.42;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      musicBus.connect(master);
      musicBus.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(master);

      this.ctx = ctx;
      this.master = master;
      this.sfxBus = sfxBus;
      this.musicBus = musicBus;
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const s = useSettingsStore.getState();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx * 0.9, t, 0.05);
  }

  // ---------- Building blocks ----------

  private tone(
    freq: number,
    start: number,
    duration: number,
    opts: ToneOptions = {},
  ): void {
    const ctx = this.ctx;
    const bus = opts.bus ?? this.sfxBus;
    if (!ctx || !bus) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo)
      osc.frequency.exponentialRampToValueAtTime(
        opts.slideTo,
        start + duration,
      );

    const peak = opts.gain ?? 0.2;
    const attack = Math.min(opts.attack ?? 0.01, duration / 2);
    const release = Math.min(opts.release ?? 0.2, duration - attack);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, start + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(
    start: number,
    duration: number,
    freq: number,
    peak: number,
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;

    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  private thump(start: number, bus: AudioNode, peak: number): void {
    this.tone(95, start, 0.35, {
      gain: peak,
      attack: 0.005,
      release: 0.3,
      slideTo: 38,
      bus,
    });
  }

  // ---------- Sound effects ----------

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || useSettingsStore.getState().muted) return;
    const t = ctx.currentTime + 0.01;

    switch (name) {
      case "click":
        this.tone(700, t, 0.05, { type: "triangle", gain: 0.12 });
        break;
      case "confirm":
        this.tone(523, t, 0.09, { type: "triangle", gain: 0.16 });
        this.tone(784, t + 0.08, 0.16, { type: "triangle", gain: 0.16 });
        break;
      case "error":
        this.tone(180, t, 0.18, { type: "sawtooth", gain: 0.1 });
        break;
      case "info":
        this.tone(660, t, 0.1, { type: "sine", gain: 0.14 });
        this.tone(880, t + 0.09, 0.14, { type: "sine", gain: 0.12 });
        break;
      case "good":
        [523, 659, 784].forEach((f, i) =>
          this.tone(f, t + i * 0.09, 0.22, { type: "triangle", gain: 0.15 }),
        );
        break;
      case "warning":
        this.tone(440, t, 0.16, { type: "triangle", gain: 0.16 });
        this.tone(370, t + 0.15, 0.26, { type: "triangle", gain: 0.16 });
        break;
      case "crisis":
        this.tone(130, t, 0.5, { type: "sawtooth", gain: 0.12, release: 0.35 });
        this.tone(98, t + 0.2, 0.6, {
          type: "sawtooth",
          gain: 0.12,
          release: 0.4,
        });
        break;
      case "decision":
        [440, 523, 659].forEach((f, i) =>
          this.tone(f, t + i * 0.12, 0.3, { type: "triangle", gain: 0.16 }),
        );
        this.tone(110, t, 0.8, { type: "sine", gain: 0.14, release: 0.6 });
        break;
      case "war":
        this.noise(t, 0.5, 600, 0.35);
        this.thump(t, this.sfxBus ?? ctx.destination, 0.5);
        this.thump(t + 0.35, this.sfxBus ?? ctx.destination, 0.45);
        this.tone(147, t, 1.1, { type: "sawtooth", gain: 0.1, release: 0.8 });
        this.tone(156, t, 1.1, { type: "sawtooth", gain: 0.1, release: 0.8 });
        break;
      case "victory":
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, t + i * 0.16, 0.5, { type: "triangle", gain: 0.17 }),
        );
        this.tone(1047, t + 0.7, 1.2, {
          type: "sine",
          gain: 0.12,
          release: 0.9,
        });
        break;
      case "defeat":
        [392, 349, 311, 262].forEach((f, i) =>
          this.tone(f, t + i * 0.28, 0.6, { type: "triangle", gain: 0.15 }),
        );
        break;
      case "intro":
        [110, 165, 220, 277].forEach((f) =>
          this.tone(f, t, 6, {
            type: "triangle",
            gain: 0.07,
            attack: 2.5,
            release: 2.5,
          }),
        );
        break;
    }
  }

  // ---------- Music ----------

  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.scheduleMusic();
  }

  setMood(mood: Mood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    if (this.musicOn) this.scheduleMusic();
  }

  private scheduleMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    const interval = this.mood === "tense" ? 3000 : 4500;
    this.musicStep();
    this.musicTimer = window.setInterval(() => this.musicStep(), interval);
  }

  private musicStep(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || ctx.state !== "running") return;
    const s = useSettingsStore.getState();
    if (s.muted || s.music <= 0.001) return;

    const t = ctx.currentTime + 0.05;
    const tense = this.mood === "tense";
    const progression = tense ? TENSE_CHORDS : CALM_CHORDS;
    const chord = progression[this.chordIndex % progression.length]!;
    this.chordIndex += 1;

    // The pad
    for (const note of chord) {
      this.tone(midi(note), t, tense ? 3.6 : 6.2, {
        type: "triangle",
        gain: tense ? 0.05 : 0.05,
        attack: tense ? 0.6 : 1.4,
        release: 1.6,
        bus,
      });
    }

    if (tense) {
      // War drums and an uneasy lead
      this.thump(t, bus, 0.35);
      this.thump(t + 1.5, bus, 0.25);
      const lead = TENSE_LEAD[Math.floor(Math.random() * TENSE_LEAD.length)]!;
      this.tone(midi(lead), t + 0.8, 1.4, {
        type: "sine",
        gain: 0.05,
        attack: 0.1,
        release: 1,
        bus,
      });
    } else if (Math.random() < 0.65) {
      // A gentle pluck
      const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]!;
      this.tone(midi(note), t + 1.5 + Math.random(), 1.8, {
        type: "sine",
        gain: 0.06,
        attack: 0.02,
        release: 1.4,
        bus,
      });
    }
  }
}

export const audio = new AudioEngine();
