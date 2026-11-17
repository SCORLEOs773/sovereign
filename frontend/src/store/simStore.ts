import { create } from "zustand";
import {
  applyPolicyPatch,
  clonePolicy,
  type OfflineReport,
  type PolicyPatch,
  type SimEvent,
  type SimSpeed,
  type SimState,
} from "@sovereign/shared";

/** Only show the "welcome back" banner if at least this many ticks were replayed. */
const MIN_OFFLINE_REPORT_TICKS = 600;

interface SimStoreState {
  ready: boolean;
  speed: SimSpeed;
  state: SimState | null;
  offline: OfflineReport | null;
  applyEvent: (event: SimEvent) => void;
  dismissOffline: () => void;
  /** Optimistic local update so sliders feel instant. The worker stays authoritative. */
  patchPolicy: (patch: PolicyPatch) => void;
}

export const useSimStore = create<SimStoreState>()((set) => ({
  ready: false,
  speed: 1,
  state: null,
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
  patchPolicy: (patch) =>
    set((s) => {
      const current = s.state;
      if (!current) return {};
      const nations = current.nations.map((n) => {
        if (n.id !== current.playerCountryId) return n;
        const policy = clonePolicy(n.policy);
        applyPolicyPatch(policy, patch);
        return { ...n, policy };
      });
      return { state: { ...current, nations } };
    }),
}));
