import { createDefaultScheduler, type Scheduler } from "./scheduler";
import type { SimSpeed } from "./speed";
import { createInitialSimState, type SimState } from "./state";
import { SIM_CONFIG } from "./time";

export class SimulationEngine {
  private state: SimState;
  private speed: SimSpeed = 1;
  private accumulatorMs = 0;
  private readonly scheduler: Scheduler;

  constructor(initial?: SimState) {
    this.state = initial ? { ...initial } : createInitialSimState();
    this.scheduler = createDefaultScheduler();
  }

  getState(): SimState {
    return { ...this.state };
  }

  getSpeed(): SimSpeed {
    return this.speed;
  }

  setSpeed(speed: SimSpeed): void {
    this.speed = speed;
    this.accumulatorMs = 0;
  }

  /** Run exactly one fixed simulation step. */
  step(): void {
    this.state.tick += 1;
    this.scheduler.runDue(this.state);
  }

  /** Run many steps at once, used for offline progression. */
  fastForward(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  /** Convert real elapsed milliseconds into whole ticks. Returns how many ticks ran. */
  advance(realDeltaMs: number): number {
    if (this.speed === 0) return 0;

    const tickMs = 1000 / (this.speed * SIM_CONFIG.ticksPerSecondAtSpeed1);
    this.accumulatorMs += realDeltaMs;

    const due = Math.floor(this.accumulatorMs / tickMs);
    const run = Math.min(due, SIM_CONFIG.maxCatchUpTicksPerFrame);
    this.accumulatorMs -= run * tickMs;
    // If we were far behind, drop the backlog instead of spiralling
    if (due > SIM_CONFIG.maxCatchUpTicksPerFrame) this.accumulatorMs = 0;

    for (let i = 0; i < run; i++) this.step();
    return run;
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
