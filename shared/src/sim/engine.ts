import { resolveDecision } from "./decisions";
import {
  playerCancelTreaty,
  playerImproveRelations,
  playerProposeTreaty,
  playerRespondProposal,
  playerSetSanctions,
} from "./diplomacy";
import { applyPolicyPatch, type PolicyPatch } from "./policy";
import { createDefaultScheduler, type Scheduler } from "./scheduler";
import type { SimSpeed } from "./speed";
import type { SimState, TreatyKind } from "./state";
import { SIM_CONFIG } from "./time";
import {
  playerDeclareWar,
  playerDemandSurrender,
  playerProposePeace,
} from "./wars";

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

  /** The clock stops at game over and while a decision waits for the player. */
  private halted(): boolean {
    return this.state.gameOver !== null || this.state.pendingDecision !== null;
  }

  /** Change the player's policy. Values are clamped to legal ranges. */
  applyPolicy(patch: PolicyPatch): void {
    if (this.state.gameOver) return;
    const nation = this.state.nations[this.state.playerCountryId];
    if (nation) applyPolicyPatch(nation.policy, patch);
  }

  resolveDecision(optionId: string): boolean {
    if (this.state.gameOver) return false;
    return resolveDecision(this.state, optionId);
  }

  improveRelations(target: number): void {
    if (!this.state.gameOver) playerImproveRelations(this.state, target);
  }

  proposeTreaty(target: number, kind: TreatyKind): void {
    if (!this.state.gameOver) playerProposeTreaty(this.state, target, kind);
  }

  cancelTreaty(treatyId: number): void {
    if (!this.state.gameOver) playerCancelTreaty(this.state, treatyId);
  }

  setSanctions(target: number, active: boolean): void {
    if (!this.state.gameOver) playerSetSanctions(this.state, target, active);
  }

  respondProposal(proposalId: number, accept: boolean): void {
    if (!this.state.gameOver)
      playerRespondProposal(this.state, proposalId, accept);
  }

  declareWar(target: number): void {
    if (!this.state.gameOver) playerDeclareWar(this.state, target);
  }

  proposePeace(warId: number): void {
    if (!this.state.gameOver) playerProposePeace(this.state, warId);
  }

  demandSurrender(warId: number): void {
    if (!this.state.gameOver) playerDemandSurrender(this.state, warId);
  }

  /** Run exactly one fixed simulation step. */
  step(): void {
    if (this.halted()) return;
    this.state.tick += 1;
    this.scheduler.runDue(this.state);
  }

  /** Run many steps at once, used for offline progression. */
  fastForward(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      if (this.halted()) break;
      this.step();
    }
  }

  /** Convert real elapsed milliseconds into whole ticks. Returns how many ticks ran. */
  advance(realDeltaMs: number): number {
    if (this.speed === 0 || this.halted()) return 0;

    const ticksPerSecond = this.speed * SIM_CONFIG.ticksPerSecondAtSpeed1;
    this.accumulatorMs += realDeltaMs;

    const due = Math.floor((this.accumulatorMs * ticksPerSecond) / 1000 + 1e-9);
    const run = Math.min(due, SIM_CONFIG.maxCatchUpTicksPerFrame);
    this.accumulatorMs -= (run * 1000) / ticksPerSecond;
    // If we were far behind, drop the backlog instead of spiralling
    if (due > SIM_CONFIG.maxCatchUpTicksPerFrame) this.accumulatorMs = 0;

    let executed = 0;
    for (let i = 0; i < run; i++) {
      if (this.halted()) break;
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
