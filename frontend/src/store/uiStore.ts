import { create } from "zustand";

export type Screen = "menu" | "setup" | "game";

interface UiState {
  screen: Screen;
  hasSave: boolean;
  setScreen: (screen: Screen) => void;
  setHasSave: (value: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  screen: "menu",
  hasSave: false,
  setScreen: (screen) => set({ screen }),
  setHasSave: (hasSave) => set({ hasSave }),
}));
