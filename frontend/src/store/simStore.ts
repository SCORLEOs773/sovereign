import { create } from "zustand";
import {
  createInitialSimState,
  type OfflineReport,
  type SimEvent,
  type SimSpeed,
  type SimState,
} from "@sovereign/shared";

/** Only show the "welcome back" banner if at least this many ticks were replayed. */
const MIN_OFFLINE_REPORT_TICKS = 60;

interface SimStoreState {
  ready: boolean;
  speed: SimSpeed;
  state: SimState;
  offline: OfflineReport | null;
  applyEvent: (event: SimEvent) => void;
  dismissOffline: () => void;
}

export const useSimStore = create<SimStoreState>()((set) => ({
  ready: false,
  speed: 1,
  state: createInitialSimState(),
  offline: null,
  applyEvent: (event) =>
    set(
      event.type === "ready"
        ? {
            ready: true,
            speed: event.speed,
            state: event.state,
            offline:
              event.offline.ticks >= MIN_OFFLINE_REPORT_TICKS
                ? event.offline
                : null,
          }
        : { speed: event.speed, state: event.state },
    ),
  dismissOffline: () => set({ offline: null }),
}));
