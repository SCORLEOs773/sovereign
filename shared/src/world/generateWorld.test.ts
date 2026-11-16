import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_SEED,
  createCountryPicker,
  generateWorld,
} from "./index";

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

  it.each([DEFAULT_WORLD_SEED, 1, 42])(
    "creates 20 populated countries (seed %i)",
    (seed) => {
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
    },
  );

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
