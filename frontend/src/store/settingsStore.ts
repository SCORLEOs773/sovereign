import { create } from "zustand";

const KEY = "sovereign.settings.v1";

interface Persisted {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  tutorialDone: boolean;
  introSeen: boolean;
}

const DEFAULTS: Persisted = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  muted: false,
  tutorialDone: false,
  introSeen: false,
};

const volume = (value: unknown, fallback: number): number =>
  typeof value === "number" && value >= 0 && value <= 1 ? value : fallback;
const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Persisted, unknown>>;
    return {
      master: volume(parsed.master, DEFAULTS.master),
      music: volume(parsed.music, DEFAULTS.music),
      sfx: volume(parsed.sfx, DEFAULTS.sfx),
      muted: flag(parsed.muted, DEFAULTS.muted),
      tutorialDone: flag(parsed.tutorialDone, DEFAULTS.tutorialDone),
      introSeen: flag(parsed.introSeen, DEFAULTS.introSeen),
    };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode). Settings then last for this session only.
  }
}

interface SettingsState extends Persisted {
  update: (patch: Partial<Persisted>) => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch);
    const s = get();
    save({
      master: s.master,
      music: s.music,
      sfx: s.sfx,
      muted: s.muted,
      tutorialDone: s.tutorialDone,
      introSeen: s.introSeen,
    });
  },
}));
