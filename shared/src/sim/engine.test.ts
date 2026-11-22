import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SEED } from "../world";
import {
  SIM_CONFIG,
  SimSnapshotSchema,
  SimulationEngine,
  TICKS_PER_DAY,
  computeOfflineTicks,
  createInitialSimState,
  formatGameDateTime,
} from "./index";
import { runTicks } from "./testUtils";

const newEngine = (): SimulationEngine =>
  new SimulationEngine(createInitialSimState(DEFAULT_WORLD_SEED, 0));
const TPS = SIM_CONFIG.ticksPerSecondAtSpeed1;

describe("SimulationEngine", () => {
  it("runs the configured ticks per second at 1x", () => {
    const engine = newEngine();
    engine.setSpeed(1);
    expect(engine.advance(1000)).toBe(TPS);
  });

  it("runs 10 times as many ticks at 10x", () => {
    const engine = newEngine();
    engine.setSpeed(10);
    expect(engine.advance(1000)).toBe(TPS * 10);
  });

  it("accumulates partial time between updates", () => {
    const engine = newEngine();
    engine.setSpeed(1);
    expect(engine.advance(30)).toBe(0);
    expect(engine.advance(30)).toBe(1);
  });

  it("does nothing while paused", () => {
    const engine = newEngine();
    engine.setSpeed(0);
    expect(engine.advance(10_000)).toBe(0);
    expect(engine.getState().tick).toBe(0);
  });

  it("caps catch-up ticks after a long stall", () => {
    const engine = newEngine();
    engine.setSpeed(1);
    expect(engine.advance(1_000_000_000)).toBe(
      SIM_CONFIG.maxCatchUpTicksPerFrame,
    );
  });

  it("gives the same result however time is sliced", () => {
    const sliced = newEngine();
    sliced.setSpeed(5);
    for (let i = 0; i < 100; i++) sliced.advance(777);
    const ticks = sliced.getState().tick;
    // 77,700 ms at 120 ticks per second is about 9,324 ticks
    expect(Math.abs(ticks - 9324)).toBeLessThanOrEqual(1);

    const stepped = newEngine();
    stepped.fastForward(ticks);
    expect(sliced.getState()).toEqual(stepped.getState());
  });

  it("fastForward matches stepping", () => {
    const a = newEngine();
    a.fastForward(5000);
    const b = newEngine();
    for (let i = 0; i < 5000; i++) b.step();
    expect(a.getState()).toEqual(b.getState());
  });

  it("counts hours, days and months from the calendar", () => {
    const day = newEngine();
    runTicks(day, TICKS_PER_DAY);
    expect(day.getState()).toMatchObject({ hours: 24, days: 1, months: 0 });

    const feb = newEngine();
    runTicks(feb, 31 * TICKS_PER_DAY);
    expect(feb.getState().months).toBe(1);

    const mar = newEngine();
    runTicks(mar, 60 * TICKS_PER_DAY); // 2032 is a leap year
    expect(mar.getState().months).toBe(2);
  });
});

describe("computeOfflineTicks", () => {
  it("does not progress a paused game", () => {
    expect(computeOfflineTicks(3600, 0)).toEqual({ ticks: 0, capped: false });
  });

  it("replays elapsed time at the offline speed", () => {
    const expected = Math.floor(100 * SIM_CONFIG.offlineSpeed * TPS);
    expect(computeOfflineTicks(100, 5)).toEqual({
      ticks: expected,
      capped: false,
    });
  });

  it("caps long absences", () => {
    const result = computeOfflineTicks(1_000_000_000, 1);
    expect(result.capped).toBe(true);
    expect(result.ticks).toBe(
      Math.floor(SIM_CONFIG.maxOfflineSeconds * SIM_CONFIG.offlineSpeed * TPS),
    );
  });
});

describe("formatGameDateTime", () => {
  it("formats the start date", () => {
    expect(formatGameDateTime(0)).toBe("1 January 2032 | 00:00");
  });

  it("formats a mid-year time", () => {
    // 74 days after 1 Jan is 15 March 2032, plus 87 ticks = 14:30
    expect(formatGameDateTime(74 * TICKS_PER_DAY + 87)).toBe(
      "15 March 2032 | 14:30",
    );
  });
});

describe("SimSnapshotSchema", () => {
  const valid = {
    version: 3,
    worldSeed: DEFAULT_WORLD_SEED,
    speed: 2,
    state: createInitialSimState(DEFAULT_WORLD_SEED, 3),
    savedAt: 1,
  };

  it("accepts a valid snapshot", () => {
    expect(SimSnapshotSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid speed", () => {
    expect(SimSnapshotSchema.safeParse({ ...valid, speed: 3 }).success).toBe(
      false,
    );
  });

  it("rejects an old snapshot version", () => {
    expect(SimSnapshotSchema.safeParse({ ...valid, version: 2 }).success).toBe(
      false,
    );
  });
});
