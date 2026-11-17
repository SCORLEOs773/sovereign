import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SEED } from "../world";
import {
  SimulationEngine,
  TICKS_PER_DAY,
  applyPolicyPatch,
  approvalTarget,
  computeBudget,
  createInitialSimState,
  holdElection,
  stabilityTarget,
  type NationState,
} from "./index";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const initial = createInitialSimState(DEFAULT_WORLD_SEED, 0);
const nation = (id: number): NationState => clone(initial.nations[id]!);

describe("starting economies", () => {
  it("run a modest deficit and valid indicators", () => {
    for (const n of initial.nations) {
      const budget = computeBudget(n);
      const deficit = (budget.spending - budget.revenue) / n.gdp;
      expect(deficit).toBeGreaterThan(-0.01);
      expect(deficit).toBeLessThan(0.05);
      expect(n.approval).toBeGreaterThanOrEqual(0);
      expect(n.approval).toBeLessThanOrEqual(100);
      expect(Number.isFinite(n.growth)).toBe(true);
    }
  });

  it("start in equilibrium for approval and stability", () => {
    for (const n of initial.nations) {
      expect(approvalTarget(n)).toBeCloseTo(n.approval, 5);
      expect(stabilityTarget(n)).toBeCloseTo(n.stability, 5);
    }
  });
});

describe("policy effects", () => {
  it("higher income tax raises revenue and lowers the approval target", () => {
    const before = nation(0);
    const after = nation(0);
    after.policy.incomeTax += 0.05;
    expect(computeBudget(after).revenue).toBeGreaterThan(
      computeBudget(before).revenue,
    );
    expect(approvalTarget(after)).toBeLessThan(approvalTarget(before));
  });

  it("more welfare spending costs money and raises the approval target", () => {
    const before = nation(0);
    const after = nation(0);
    after.policy.spending.welfare += 0.02;
    expect(computeBudget(after).spending).toBeGreaterThan(
      computeBudget(before).spending,
    );
    expect(approvalTarget(after)).toBeGreaterThan(approvalTarget(before));
  });

  it("clamps policy changes to legal ranges", () => {
    const n = nation(0);
    applyPolicyPatch(n.policy, {
      incomeTax: 5,
      corporateTax: -1,
      spending: { health: 9 },
    });
    expect(n.policy.incomeTax).toBe(0.6);
    expect(n.policy.corporateTax).toBe(0);
    expect(n.policy.spending.health).toBe(0.2);
  });
});

describe("long-run simulation", () => {
  it("keeps every nation finite and bounded over ten years", () => {
    const engine = new SimulationEngine(
      createInitialSimState(DEFAULT_WORLD_SEED, 0),
    );
    engine.fastForward(10 * 365 * TICKS_PER_DAY);
    for (const n of engine.getState().nations) {
      for (const value of [
        n.population,
        n.gdp,
        n.treasury,
        n.debt,
        n.inflation,
        n.unemployment,
        n.approval,
        n.stability,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(n.approval).toBeGreaterThanOrEqual(0);
      expect(n.approval).toBeLessThanOrEqual(100);
      expect(n.unemployment).toBeGreaterThan(0);
    }
  });

  it("never changes the player's policy on its own", () => {
    const engine = new SimulationEngine(
      createInitialSimState(DEFAULT_WORLD_SEED, 0),
    );
    const before = JSON.stringify(engine.getState().nations[0]!.policy);
    engine.fastForward(3 * 365 * TICKS_PER_DAY);
    expect(JSON.stringify(engine.getState().nations[0]!.policy)).toBe(before);
  });

  it("lets AI nations adapt their policy", () => {
    const engine = new SimulationEngine(
      createInitialSimState(DEFAULT_WORLD_SEED, 0),
    );
    engine.fastForward(5 * 365 * TICKS_PER_DAY);
    const changed = engine
      .getState()
      .nations.some(
        (n) =>
          n.id !== 0 && JSON.stringify(n.policy) !== JSON.stringify(n.baseline),
      );
    expect(changed).toBe(true);
  });

  it("applies the player's policy through the engine", () => {
    const engine = new SimulationEngine(
      createInitialSimState(DEFAULT_WORLD_SEED, 0),
    );
    engine.applyPolicy({ incomeTax: 0.4 });
    expect(engine.getState().nations[0]!.policy.incomeTax).toBe(0.4);
  });
});

describe("elections", () => {
  it("re-elects a popular leader", () => {
    const state = createInitialSimState(DEFAULT_WORLD_SEED, 0);
    state.nations[0]!.approval = 90;
    expect(holdElection(state)).toBe(true);
    expect(state.gameOver).toBeNull();
  });

  it("ends the game when an unpopular leader loses", () => {
    const state = createInitialSimState(DEFAULT_WORLD_SEED, 0);
    state.nations[0]!.approval = 5;
    expect(holdElection(state)).toBe(false);
    expect(state.gameOver?.reason).toBe("election");
  });
});
