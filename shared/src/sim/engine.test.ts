import { describe, expect, it } from "vitest";
import {
  SIM_CONFIG,
  SimSnapshotSchema,
  SimulationEngine,
  TICKS_PER_DAY,
  computeOfflineTicks,
  formatGameDateTime,
} from "./index";

describe("SimulationEngine", () => {
  it("runs 1 tick per second at 1x", () => {
    const engine = new SimulationEngine();
    engine.setSpeed(1);
    expect(engine.advance(1000)).toBe(1);
    expect(engine.getState().tick).toBe(1);
  });

  it("runs 10 ticks per second at 10x", () => {
    const engine = new SimulationEngine();
    engine.setSpeed(10);
    expect(engine.advance(1000)).toBe(10);
  });

  it("accumulates partial time between updates", () => {
    const engine = new SimulationEngine();
    engine.setSpeed(1);
    expect(engine.advance(500)).toBe(0);
    expect(engine.advance(500)).toBe(1);
  });

  it("does nothing while paused", () => {
    const engine = new SimulationEngine();
    engine.setSpeed(0);
    expect(engine.advance(10_000)).toBe(0);
    expect(engine.getState().tick).toBe(0);
  });

  it("caps catch-up ticks after a long stall", () => {
    const engine = new SimulationEngine();
    engine.setSpeed(1);
    expect(engine.advance(1_000_000_000)).toBe(
      SIM_CONFIG.maxCatchUpTicksPerFrame,
    );
  });

  it("gives the same result however time is sliced", () => {
    const sliced = new SimulationEngine();
    sliced.setSpeed(5);
    for (let i = 0; i < 100; i++) sliced.advance(777);
    // 77,700 ms at 200 ms per tick = 388 whole ticks
    expect(sliced.getState().tick).toBe(388);

    const stepped = new SimulationEngine();
    for (let i = 0; i < 388; i++) stepped.step();
    expect(sliced.getState()).toEqual(stepped.getState());
  });

  it("fastForward matches stepping", () => {
    const a = new SimulationEngine();
    a.fastForward(5000);
    const b = new SimulationEngine();
    for (let i = 0; i < 5000; i++) b.step();
    expect(a.getState()).toEqual(b.getState());
  });

  it("counts hours, days and months from the calendar", () => {
    const engine = new SimulationEngine();
    engine.fastForward(TICKS_PER_DAY);
    expect(engine.getState()).toMatchObject({ hours: 24, days: 1, months: 0 });

    const feb = new SimulationEngine();
    feb.fastForward(31 * TICKS_PER_DAY);
    expect(feb.getState().months).toBe(1);

    const mar = new SimulationEngine();
    mar.fastForward(60 * TICKS_PER_DAY); // 2032 is a leap year
    expect(mar.getState().months).toBe(2);
  });
});

describe("computeOfflineTicks", () => {
  it("does not progress a paused game", () => {
    expect(computeOfflineTicks(3600, 0)).toEqual({ ticks: 0, capped: false });
  });

  it("replays elapsed seconds at 1x", () => {
    expect(computeOfflineTicks(100, 5)).toEqual({ ticks: 100, capped: false });
  });

  it("caps long absences", () => {
    const result = computeOfflineTicks(1_000_000_000, 1);
    expect(result.capped).toBe(true);
    expect(result.ticks).toBe(SIM_CONFIG.maxOfflineSeconds);
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
    version: 1,
    worldSeed: 2026,
    speed: 2,
    state: { tick: 10, hours: 1, days: 0, months: 0 },
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
});
