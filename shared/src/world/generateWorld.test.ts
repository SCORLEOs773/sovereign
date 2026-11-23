import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_SEED,
  createCountryPicker,
  generateWorld,
} from "./index";

const SEEDS = [
  DEFAULT_WORLD_SEED,
  1,
  2,
  3,
  7,
  42,
  99,
  123,
  777,
  31337,
  90210,
  424242,
];

describe("generateWorld", () => {
  it("is deterministic for the same seed", () => {
    const a = generateWorld(DEFAULT_WORLD_SEED);
    const b = generateWorld(DEFAULT_WORLD_SEED);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces a different world for a different seed", () => {
    const a = generateWorld(1);
    const b = generateWorld(2);
    expect(JSON.stringify(a.cells)).not.toBe(JSON.stringify(b.cells));
  });

  it.each(SEEDS)("creates 20 populated countries (seed %i)", (seed) => {
    const world = generateWorld(seed);
    expect(world.countries).toHaveLength(20);
    for (const country of world.countries) {
      expect(country.area).toBeGreaterThan(0);
      expect(country.population).toBeGreaterThan(0);
    }
    for (const cell of world.cells) {
      expect(cell.countryId).toBeGreaterThanOrEqual(0);
      expect(cell.countryId).toBeLessThan(20);
    }
    for (const s of world.segments) {
      expect(s.a).toBeGreaterThanOrEqual(0);
      expect(s.a).toBeLessThan(20);
      expect(s.b).toBeGreaterThanOrEqual(-1);
      expect(s.b).toBeLessThan(20);
    }
  });

  it("produces visibly different planets", () => {
    const signatures = new Set<string>();
    const regionCounts = new Set<number>();
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      const regions = new Set(world.countries.map((c) => c.region));
      regionCounts.add(regions.size);
      signatures.add(`${regions.size}:${world.cells.length}`);
    }
    expect(signatures.size).toBeGreaterThanOrEqual(8);
    expect(regionCounts.size).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("gives every country a distinct colour", () => {
    const world = generateWorld(DEFAULT_WORLD_SEED);
    expect(new Set(world.countries.map((c) => c.color)).size).toBe(20);
  });

  it("picks the right country at each capital", () => {
    const world = generateWorld(DEFAULT_WORLD_SEED);
    const pick = createCountryPicker(world);
    for (const country of world.countries) {
      expect(pick(country.capital.x, country.capital.y)).toBe(country.id);
    }
  });

  it("returns -1 outside the world", () => {
    const world = generateWorld(DEFAULT_WORLD_SEED);
    expect(createCountryPicker(world)(-5, -5)).toBe(-1);
  });
});
