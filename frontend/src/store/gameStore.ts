import { create } from "zustand";
import {
  DEFAULT_WORLD_SEED,
  generateWorld,
  type World,
} from "@sovereign/shared";

interface GameState {
  world: World;
  selectedCountryId: number | null;
  hoveredCountryId: number | null;
  selectCountry: (id: number | null) => void;
  hoverCountry: (id: number | null) => void;
  regenerateWorld: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  world: generateWorld(DEFAULT_WORLD_SEED),
  selectedCountryId: null,
  hoveredCountryId: null,
  selectCountry: (id) => set({ selectedCountryId: id }),
  hoverCountry: (id) => set({ hoveredCountryId: id }),
  regenerateWorld: () =>
    set({
      world: generateWorld(Math.floor(Math.random() * 1_000_000)),
      selectedCountryId: null,
      hoveredCountryId: null,
    }),
}));
