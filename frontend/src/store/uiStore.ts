import { create } from "zustand";

export type Screen = "menu" | "setup" | "game";
export type MapMode = "political" | "relations" | "economy";

interface UiState {
  screen: Screen;
  hasSave: boolean;
  mapMode: MapMode;
  setScreen: (screen: Screen) => void;
  setHasSave: (value: boolean) => void;
  setMapMode: (mode: MapMode) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  screen: "menu",
  hasSave: false,
  mapMode: "political",
  setScreen: (screen) => set({ screen }),
  setHasSave: (hasSave) => set({ hasSave }),
  setMapMode: (mapMode) => set({ mapMode }),
}));
