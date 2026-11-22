import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SEED } from "../world";
import { createRng } from "../world/random";
import {
  DECISION_TEMPLATES,
  MAX_TRADE_TREATIES,
  SIM_CONFIG,
  SimulationEngine,
  changeRelation,
  computeScore,
  createInitialSimState,
  evaluateProposal,
  findTreaty,
  getObjectives,
  getRelation,
  playerImproveRelations,
  playerProposeTreaty,
  playerRespondProposal,
  playerSetSanctions,
  refreshDiplomacyEffects,
  resolveDecision,
  runMonthly,
  signTreaty,
  triggerDecision,
  type SimState,
} from "./index";

const base = createInitialSimState(DEFAULT_WORLD_SEED, 0);
const copy = (): SimState => JSON.parse(JSON.stringify(base)) as SimState;
const setRelation = (s: SimState, a: number, b: number, value: number): void =>
  changeRelation(s, a, b, value - getRelation(s, a, b));

describe("relations", () => {
  it("start symmetric and in range", () => {
    const s = copy();
    for (let i = 0; i < s.nations.length; i++) {
      for (let j = 0; j < s.nations.length; j++) {
        expect(s.relations[i]![j]).toBe(s.relations[j]![i]);
        expect(Math.abs(s.relations[i]![j]!)).toBeLessThanOrEqual(100);
      }
    }
  });

  it("improve relations costs money and has a cooldown", () => {
    const s = copy();
    const before = getRelation(s, 0, 1);
    const treasury = s.nations[0]!.treasury;
    expect(playerImproveRelations(s, 1).ok).toBe(true);
    expect(getRelation(s, 0, 1)).toBeCloseTo(before + 10, 5);
    expect(s.nations[0]!.treasury).toBeLessThan(treasury);
    expect(playerImproveRelations(s, 1).ok).toBe(false);
  });
});

describe("treaties", () => {
  it("AI accepts or declines based on relations", () => {
    const s = copy();
    setRelation(s, 0, 1, -30);
    expect(evaluateProposal(s, 1, 0, "trade").ok).toBe(false);
    setRelation(s, 0, 1, 30);
    expect(evaluateProposal(s, 1, 0, "trade").ok).toBe(true);
  });

  it("a trade agreement boosts growth for both partners", () => {
    const s = copy();
    setRelation(s, 0, 1, 40);
    expect(playerProposeTreaty(s, 1, "trade").ok).toBe(true);
    expect(findTreaty(s, 0, 1, "trade")).toBeDefined();
    refreshDiplomacyEffects(s);
    expect(s.nations[0]!.tradeBonus).toBeGreaterThan(0);
    expect(s.nations[1]!.tradeBonus).toBeGreaterThan(0);
  });

  it("limits the number of trade agreements", () => {
    const s = copy();
    for (let k = 1; k <= MAX_TRADE_TREATIES; k++) signTreaty(s, 0, k, "trade");
    setRelation(s, 0, 10, 60);
    expect(playerProposeTreaty(s, 10, "trade").ok).toBe(false);
  });

  it("accepting an AI proposal signs the treaty", () => {
    const s = copy();
    const id = s.nextId;
    s.nextId += 1;
    s.proposals.push({
      id,
      from: 2,
      kind: "nonAggression",
      tick: 0,
      expires: 1_000_000,
    });
    expect(playerRespondProposal(s, id, true).ok).toBe(true);
    expect(findTreaty(s, 0, 2, "nonAggression")).toBeDefined();
    expect(s.proposals).toHaveLength(0);
  });
});

describe("sanctions", () => {
  it("hurt the target and strain relations", () => {
    const s = copy();
    const before = getRelation(s, 0, 1);
    expect(playerSetSanctions(s, 1, true).ok).toBe(true);
    expect(getRelation(s, 0, 1)).toBeLessThan(before - 30);
    refreshDiplomacyEffects(s);
    expect(s.nations[1]!.sanctionPenalty).toBeGreaterThan(0);
    expect(s.nations[0]!.sanctionPenalty).toBeGreaterThan(0);
    expect(playerSetSanctions(s, 1, false).ok).toBe(true);
  });
});

describe("decisions", () => {
  for (const template of DECISION_TEMPLATES) {
    it(`resolves every option of "${template.id}" cleanly`, () => {
      for (const option of template.options) {
        const s = copy();
        expect(triggerDecision(s, template.id, createRng(1))).toBe(true);
        expect(s.pendingDecision).not.toBeNull();
        expect(resolveDecision(s, option.id)).toBe(true);
        expect(s.pendingDecision).toBeNull();
        const p = s.nations[0]!;
        for (const v of [
          p.approval,
          p.stability,
          p.growth,
          p.inflation,
          p.unemployment,
          p.treasury,
          p.debt,
          p.population,
        ]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    });
  }

  it("pauses the clock while a decision is pending", () => {
    const s = copy();
    triggerDecision(s, "oil", createRng(1));
    const engine = new SimulationEngine(s);
    engine.setSpeed(1);
    expect(engine.advance(1000)).toBe(0);
    expect(engine.resolveDecision(s.pendingDecision!.options[0]!.id)).toBe(
      true,
    );
    expect(engine.advance(1000)).toBeGreaterThan(0);
  });
});

describe("objectives and the ending", () => {
  it("reports objectives and a finite score", () => {
    const s = copy();
    const objectives = getObjectives(s);
    expect(objectives.length).toBeGreaterThan(0);
    for (const o of objectives) {
      expect(o.progress).toBeGreaterThanOrEqual(0);
      expect(o.progress).toBeLessThanOrEqual(1);
    }
    expect(Number.isFinite(computeScore(s))).toBe(true);
  });

  it("ends the campaign in the final year", () => {
    const s = copy();
    s.tick = Math.round(
      (Date.UTC(SIM_CONFIG.campaignEndYear, 0, 1) - SIM_CONFIG.startDateUtc) /
        (SIM_CONFIG.minutesPerTick * 60_000),
    );
    runMonthly(s);
    expect(s.gameOver?.reason).toBe("retirement");
  });
});
