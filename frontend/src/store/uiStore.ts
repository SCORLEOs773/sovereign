import { create } from "zustand";
import { useSettingsStore } from "./settingsStore";

export type Screen = "menu" | "setup" | "game";
export type MapMode = "political" | "relations" | "economy" | "military";

interface UiState {
  screen: Screen;
  hasSave: boolean;
  mapMode: MapMode;
  introOpen: boolean;
  settingsOpen: boolean;
  briefingOpen: boolean;
  /** Index of the current tutorial step, or null when the tour is not running */
  tutorialStep: number | null;
  setScreen: (screen: Screen) => void;
  setHasSave: (value: boolean) => void;
  setMapMode: (mode: MapMode) => void;
  setIntroOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setBriefingOpen: (value: boolean) => void;
  setTutorialStep: (step: number | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  screen: "menu",
  hasSave: false,
  mapMode: "political",
  introOpen: !useSettingsStore.getState().introSeen,
  settingsOpen: false,
  briefingOpen: false,
  tutorialStep: null,
  setScreen: (screen) => set({ screen }),
  setHasSave: (hasSave) => set({ hasSave }),
  setMapMode: (mapMode) => set({ mapMode }),
  setIntroOpen: (introOpen) => set({ introOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setBriefingOpen: (briefingOpen) => set({ briefingOpen }),
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
}));
