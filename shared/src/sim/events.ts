import type { SimState } from "./state";
import { TICKS_PER_DAY } from "./time";

export type EventKind = "info" | "good" | "warning" | "crisis";

const MAX_EVENTS = 80;

export function pushEvent(
  state: SimState,
  kind: EventKind,
  text: string,
): void {
  state.events.push({ tick: state.tick, kind, text });
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }
}

/** Like pushEvent, but each alert key can fire at most once per cooldown. */
export function raiseAlert(
  state: SimState,
  key: string,
  cooldownMonths: number,
  kind: EventKind,
  text: string,
): void {
  const last = state.alerts[key];
  const cooldownTicks = cooldownMonths * 30 * TICKS_PER_DAY;
  if (last !== undefined && state.tick - last < cooldownTicks) return;
  state.alerts[key] = state.tick;
  pushEvent(state, kind, text);
}
