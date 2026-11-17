import { applyPolicyPatch, type PolicyPatch } from "./policy";
import { createDefaultScheduler, type Scheduler } from "./scheduler";
import type { SimSpeed } from "./speed";
import type { SimState } from "./state";
import { SIM_CONFIG } from "./time";

export class SimulationEngine {
  private readonly state: SimState;
  private speed: SimSpeed = 1;
  private accumulatorMs = 0;
  private readonly scheduler: Scheduler;

  /** The engine takes ownership of the state object it is given. */
  constructor(initial: SimState) {
    this.state = initial;
    this.scheduler = createDefaultScheduler();
  }

  /** Returns the live state. Treat it as read-only. */
  getState(): SimState {
    return this.state;
  }

  getSpeed(): SimSpeed {
    return this.speed;
  }

  setSpeed(speed: SimSpeed): void {
    this.speed = speed;
    this.accumulatorMs = 0;
  }

  /** Change the player's policy. Values are clamped to legal ranges. */
  applyPolicy(patch: PolicyPatch): void {
    if (this.state.gameOver) return;
    const nation = this.state.nations[this.state.playerCountryId];
    if (nation) applyPolicyPatch(nation.policy, patch);
  }

  /** Run exactly one fixed simulation step. */
  step(): void {
    if (this.state.gameOver) return;
    this.state.tick += 1;
    this.scheduler.runDue(this.state);
  }

  /** Run many steps at once, used for offline progression. */
  fastForward(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      if (this.state.gameOver) break;
      this.step();
    }
  }

  /** Convert real elapsed milliseconds into whole ticks. Returns how many ticks ran. */
  advance(realDeltaMs: number): number {
    if (this.speed === 0 || this.state.gameOver) return 0;

    const ticksPerSecond = this.speed * SIM_CONFIG.ticksPerSecondAtSpeed1;
    this.accumulatorMs += realDeltaMs;

    const due = Math.floor((this.accumulatorMs * ticksPerSecond) / 1000 + 1e-9);
    const run = Math.min(due, SIM_CONFIG.maxCatchUpTicksPerFrame);
    this.accumulatorMs -= (run * 1000) / ticksPerSecond;
    // If we were far behind, drop the backlog instead of spiralling
    if (due > SIM_CONFIG.maxCatchUpTicksPerFrame) this.accumulatorMs = 0;

    let executed = 0;
    for (let i = 0; i < run; i++) {
      if (this.state.gameOver) break;
      this.step();
      executed++;
    }
    return executed;
  }
}

export interface OfflineProgress {
  ticks: number;
  capped: boolean;
}

/** How many ticks to replay for the time a player was away. */
export function computeOfflineTicks(
  elapsedSeconds: number,
  speedAtSave: SimSpeed,
): OfflineProgress {
  if (speedAtSave === 0 || elapsedSeconds <= 0)
    return { ticks: 0, capped: false };
  const capped = elapsedSeconds > SIM_CONFIG.maxOfflineSeconds;
  const seconds = Math.min(elapsedSeconds, SIM_CONFIG.maxOfflineSeconds);
  return {
    ticks: Math.floor(
      seconds * SIM_CONFIG.offlineSpeed * SIM_CONFIG.ticksPerSecondAtSpeed1,
    ),
    capped,
  };
}
