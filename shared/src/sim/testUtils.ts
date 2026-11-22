import type { SimulationEngine } from "./engine";

/** Run the engine forward, always picking the first option of any decision. */
export function runTicks(engine: SimulationEngine, ticks: number): void {
  let remaining = ticks;
  while (remaining > 0) {
    const before = engine.getState().tick;
    engine.fastForward(remaining);
    remaining -= engine.getState().tick - before;
    const state = engine.getState();
    if (state.gameOver) return;
    const decision = state.pendingDecision;
    if (!decision) return;
    engine.resolveDecision(decision.options[0]!.id);
  }
}
