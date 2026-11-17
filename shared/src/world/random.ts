export interface Rng {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (maxExclusive: number) => number;
}

/** Seeded deterministic random number generator (mulberry32). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
  };
}

/** Combine three numbers into one well-mixed seed. */
export function mixSeed(a: number, b: number, c: number): number {
  let h =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35) ^
    Math.imul((c + 1) | 0, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}
