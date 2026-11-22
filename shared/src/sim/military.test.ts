import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SEED } from "../world";
import {
  SimulationEngine,
  TICKS_PER_DAY,
  armyTarget,
  canDeclareWar,
  createInitialSimState,
  declareWar,
  equipmentTarget,
  findWarBetween,
  inRange,
  isAtWar,
  playerDemandSurrender,
  playerProposePeace,
  runWarsMonthly,
  signTreaty,
  type SimState,
} from "./index";
import { runTicks } from "./testUtils";

const base = createInitialSimState(DEFAULT_WORLD_SEED, 0);
const copy = (): SimState => JSON.parse(JSON.stringify(base)) as SimState;
const neighbourOfPlayer = (s: SimState): number => s.adjacency[0]![0]!;
const MONTH = 30 * TICKS_PER_DAY;

function findAiPair(s: SimState): [number, number] | null {
  for (const n of s.nations) {
    if (n.id === 0) continue;
    const other = s.adjacency[n.id]!.find((x) => x !== 0);
    if (other !== undefined) return [n.id, other];
  }
  return null;
}

describe("armed forces", () => {
  it("start in balance with their defence budget", () => {
    for (const n of base.nations) {
      expect(armyTarget(n)).toBeCloseTo(n.army, 3);
      expect(equipmentTarget(n)).toBeCloseTo(n.equipment, 5);
    }
  });

  it("defence spending raises both the equipment and recruitment targets", () => {
    const n = JSON.parse(
      JSON.stringify(base.nations[0]!),
    ) as SimState["nations"][number];
    const equipment = equipmentTarget(n);
    const army = armyTarget(n);
    n.policy.spending.defence *= 2;
    expect(equipmentTarget(n)).toBeGreaterThan(equipment);
    expect(armyTarget(n)).toBeGreaterThan(army);
  });
});

describe("declaring war", () => {
  it("creates a war against a neighbour and sours relations", () => {
    const s = copy();
    const t = neighbourOfPlayer(s);
    expect(canDeclareWar(s, 0, t).ok).toBe(true);
    const before = s.relations[0]![t]!;
    declareWar(s, 0, t);
    expect(isAtWar(s, 0)).toBe(true);
    expect(findWarBetween(s, 0, t)).toBeDefined();
    expect(s.relations[0]![t]!).toBeLessThan(before);
  });

  it("is blocked against allies and out-of-range nations", () => {
    const s = copy();
    const t = neighbourOfPlayer(s);
    signTreaty(s, 0, t, "alliance");
    expect(canDeclareWar(s, 0, t).ok).toBe(false);
    const far = s.nations.find((n) => n.id !== 0 && !inRange(s, 0, n.id));
    expect(far).toBeDefined();
    expect(canDeclareWar(s, 0, far!.id).ok).toBe(false);
  });
});

describe("fighting a war", () => {
  it("a much stronger attacker wins and collects reparations", () => {
    const s = copy();
    const t = neighbourOfPlayer(s);
    s.nations[0]!.army *= 30;
    s.nations[0]!.equipment = 100;
    const treasuryBefore = s.nations[0]!.treasury;
    declareWar(s, 0, t);
    for (let i = 0; i < 15; i++) {
      s.tick += MONTH;
      runWarsMonthly(s);
    }
    expect(s.warsWon).toBe(1);
    expect(s.wars).toHaveLength(0);
    expect(s.truces.length).toBeGreaterThan(0);
    expect(s.nations[0]!.treasury).toBeGreaterThan(treasuryBefore);
  });

  it("the AI accepts a ceasefire only when it is losing or weary", () => {
    const s = copy();
    const t = neighbourOfPlayer(s);
    const war = declareWar(s, 0, t);
    war.score = -40;
    expect(playerProposePeace(s, war.id).ok).toBe(false);
    war.score = 30;
    expect(playerProposePeace(s, war.id).ok).toBe(true);
    expect(s.wars).toHaveLength(0);
    expect(canDeclareWar(s, 0, t).ok).toBe(false);
  });

  it("demanding surrender needs a decisive advantage", () => {
    const s = copy();
    const t = neighbourOfPlayer(s);
    const war = declareWar(s, 0, t);
    war.score = 49;
    expect(playerDemandSurrender(s, war.id).ok).toBe(false);
    war.score = 50;
    expect(playerDemandSurrender(s, war.id).ok).toBe(true);
    expect(s.warsWon).toBe(1);
    expect(s.wars).toHaveLength(0);
  });

  it("ends the game when the player's country is overrun", () => {
    const s = copy();
    const t = neighbourOfPlayer(s);
    s.nations[t]!.army *= 50;
    s.nations[t]!.equipment = 100;
    const war = declareWar(s, t, 0);
    war.occupations.push({ holder: t, victim: 0, fraction: 0.9 });
    runWarsMonthly(s);
    expect(s.gameOver?.reason).toBe("conquest");
  });

  it("keeps wars well-formed and ends AI-only wars on their own", () => {
    const s = copy();
    const pair = findAiPair(s);
    if (!pair) throw new Error("No AI neighbours found");
    const war = declareWar(s, pair[0], pair[1]);
    const engine = new SimulationEngine(s);
    runTicks(engine, 40 * MONTH);
    const state = engine.getState();
    for (const w of state.wars) {
      expect(Math.abs(w.score)).toBeLessThanOrEqual(100);
      for (const o of w.occupations) {
        expect(o.fraction).toBeGreaterThanOrEqual(0);
        expect(o.fraction).toBeLessThanOrEqual(1);
      }
      for (const id of [...w.attackers, ...w.defenders])
        expect(state.nations[id]).toBeDefined();
    }
    for (const n of state.nations) {
      expect(Number.isFinite(n.army)).toBe(true);
      expect(n.army).toBeGreaterThanOrEqual(1000);
    }
    if (!state.gameOver)
      expect(state.wars.some((w) => w.id === war.id)).toBe(false);
  });
});
