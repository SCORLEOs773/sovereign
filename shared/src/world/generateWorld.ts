import { Delaunay } from "d3-delaunay";
import { createRng, type Rng } from "./random";
import { fbm } from "./noise";
import { ARCHETYPES, COUNTRY_DEFS, LAND_MASSES } from "./countryData";
import type { Country, Segment, World, WorldCell } from "./types";

export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 1000;
export const DEFAULT_WORLD_SEED = 2026;

const SITE_COUNT = 2000;
const RELAX_ITERATIONS = 2;
const LAND_THRESHOLD = 0.12;
const POPULATION_PER_CELL = 600_000;

type Point = [number, number];

function relaxedSites(
  rng: Rng,
  count: number,
  width: number,
  height: number,
  iterations: number,
): Point[] {
  let points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push([rng.range(0, width), rng.range(0, height)]);
  }
  for (let it = 0; it < iterations; it++) {
    const voronoi = Delaunay.from(points).voronoi([0, 0, width, height]);
    points = points.map((p, i): Point => {
      const poly = voronoi.cellPolygon(i);
      if (!poly || poly.length < 2) return p;
      const vertexCount = poly.length - 1;
      let cx = 0;
      let cy = 0;
      for (let k = 0; k < vertexCount; k++) {
        const v = poly[k]!;
        cx += v[0];
        cy += v[1];
      }
      return [cx / vertexCount, cy / vertexCount];
    });
  }
  return points;
}

function flattenPolygon(poly: ReadonlyArray<ArrayLike<number>>): number[] {
  const out: number[] = [];
  for (let k = 0; k < poly.length - 1; k++) {
    const v = poly[k]!;
    out.push(v[0]!, v[1]!);
  }
  return out;
}

function vertexKey(x: number, y: number): string {
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function sharedEdge(
  a: number[],
  b: number[],
): [number, number, number, number] | null {
  const keys = new Set<string>();
  for (let k = 0; k < b.length; k += 2) keys.add(vertexKey(b[k]!, b[k + 1]!));
  const found: number[] = [];
  for (let k = 0; k < a.length; k += 2) {
    if (keys.has(vertexKey(a[k]!, a[k + 1]!))) {
      found.push(a[k]!, a[k + 1]!);
      if (found.length === 4) break;
    }
  }
  return found.length === 4
    ? [found[0]!, found[1]!, found[2]!, found[3]!]
    : null;
}

function distSq(points: Point[], a: number, b: number): number {
  const dx = points[a]![0] - points[b]![0];
  const dy = points[a]![1] - points[b]![1];
  return dx * dx + dy * dy;
}

/** Farthest-point sampling so country capitals/seeds are spread out. */
function pickSeeds(
  rng: Rng,
  cells: number[],
  points: Point[],
  wanted: number,
): number[] {
  const target = Math.min(wanted, cells.length);
  const chosen: number[] = [cells[rng.int(cells.length)]!];
  const minDist = cells.map((c) => distSq(points, c, chosen[0]!));
  while (chosen.length < target) {
    let bestIndex = 0;
    let bestValue = -1;
    for (let j = 0; j < cells.length; j++) {
      if (minDist[j]! > bestValue) {
        bestValue = minDist[j]!;
        bestIndex = j;
      }
    }
    const next = cells[bestIndex]!;
    chosen.push(next);
    for (let j = 0; j < cells.length; j++) {
      minDist[j] = Math.min(minDist[j]!, distSq(points, cells[j]!, next));
    }
  }
  return chosen;
}

/** Keep only the biggest connected piece of each landmass, turn the rest into water. */
function keepLargestComponents(
  massOf: number[],
  neighbors: number[][],
  massCount: number,
): void {
  const n = massOf.length;
  const comp: number[] = new Array(n).fill(-1);
  const compSize: number[] = [];
  const compMass: number[] = [];

  for (let i = 0; i < n; i++) {
    if (massOf[i]! < 0 || comp[i]! !== -1) continue;
    const id = compSize.length;
    const stack = [i];
    comp[i] = id;
    let size = 0;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      size++;
      for (const nb of neighbors[cur]!) {
        if (massOf[nb] === massOf[i] && comp[nb] === -1) {
          comp[nb] = id;
          stack.push(nb);
        }
      }
    }
    compSize.push(size);
    compMass.push(massOf[i]!);
  }

  const best: number[] = new Array(massCount).fill(-1);
  for (let c = 0; c < compSize.length; c++) {
    const m = compMass[c]!;
    if (best[m] === -1 || compSize[c]! > compSize[best[m]!]!) best[m] = c;
  }
  for (let i = 0; i < n; i++) {
    if (comp[i]! >= 0 && best[massOf[i]!] !== comp[i]) massOf[i] = -1;
  }
}

export function generateWorld(seed: number): World {
  const rng = createRng(seed);
  const width = WORLD_WIDTH;
  const height = WORLD_HEIGHT;

  // 1. Voronoi cells
  const points = relaxedSites(rng, SITE_COUNT, width, height, RELAX_ITERATIONS);
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);
  const n = points.length;

  const polygons: number[][] = [];
  const neighbors: number[][] = [];
  for (let i = 0; i < n; i++) {
    const poly = voronoi.cellPolygon(i);
    polygons.push(poly ? flattenPolygon(poly) : []);
    neighbors.push(Array.from(delaunay.neighbors(i)));
  }

  // 2. Land mask: distance to each landmass centre plus noise for ragged coasts
  const massOf: number[] = new Array(n).fill(-1);
  const noiseSeed = seed & 0xffff;
  for (let i = 0; i < n; i++) {
    if (polygons[i]!.length === 0) continue;
    const [x, y] = points[i]!;
    let best = -Infinity;
    let bestMass = -1;
    for (let m = 0; m < LAND_MASSES.length; m++) {
      const mass = LAND_MASSES[m]!;
      const score = 1 - Math.hypot(x - mass.x, y - mass.y) / mass.r;
      if (score > best) {
        best = score;
        bestMass = m;
      }
    }
    const noise = fbm(x / 150, y / 150, noiseSeed, 3);
    if (best + (noise - 0.5) * 0.7 > LAND_THRESHOLD) massOf[i] = bestMass;
  }
  keepLargestComponents(massOf, neighbors, LAND_MASSES.length);

  // 3. Seed countries on each landmass
  const owner: number[] = new Array(n).fill(-1);
  const seeds: number[] = [];
  const countryMass: number[] = [];
  for (let m = 0; m < LAND_MASSES.length; m++) {
    const cells: number[] = [];
    for (let i = 0; i < n; i++) if (massOf[i] === m) cells.push(i);
    if (cells.length === 0) continue;
    const chosen = pickSeeds(rng, cells, points, LAND_MASSES[m]!.countries);
    for (const s of chosen) {
      owner[s] = seeds.length;
      seeds.push(s);
      countryMass.push(m);
    }
  }
  const countryCount = seeds.length;

  // 4. Grow countries outward with different speeds so sizes vary
  const frontier: number[][] = seeds.map(() => []);
  const pushNeighbors = (c: number, cell: number): void => {
    for (const nb of neighbors[cell]!) {
      if (owner[nb] === -1 && massOf[nb] === countryMass[c])
        frontier[c]!.push(nb);
    }
  };
  seeds.forEach((s, c) => pushNeighbors(c, s));

  const claim = (c: number): boolean => {
    const f = frontier[c]!;
    while (f.length > 0) {
      const idx = rng.int(f.length);
      const cell = f[idx]!;
      f[idx] = f[f.length - 1]!;
      f.pop();
      if (owner[cell] !== -1) continue;
      owner[cell] = c;
      pushNeighbors(c, cell);
      return true;
    }
    return false;
  };

  const weights = seeds.map(() => rng.range(0.6, 1.7));
  const credit = seeds.map(() => 0);
  const done = seeds.map(() => false);
  let active = true;
  while (active) {
    active = false;
    for (let c = 0; c < countryCount; c++) {
      if (done[c]) continue;
      credit[c]! += weights[c]!;
      while (credit[c]! >= 1) {
        credit[c]! -= 1;
        if (!claim(c)) {
          done[c] = true;
          break;
        }
      }
      if (!done[c]) active = true;
    }
  }

  // 5. Borders and coastlines
  const segments: Segment[] = [];
  for (let i = 0; i < n; i++) {
    for (const nb of neighbors[i]!) {
      if (nb < i) continue;
      const a = owner[i]!;
      const b = owner[nb]!;
      if (a === b) continue;
      const edge = sharedEdge(polygons[i]!, polygons[nb]!);
      if (!edge) continue;
      const landOwner = a === -1 ? b : a;
      const other = a === -1 || b === -1 ? -1 : a === landOwner ? b : a;
      segments.push({
        x1: edge[0],
        y1: edge[1],
        x2: edge[2],
        y2: edge[3],
        a: landOwner,
        b: other,
      });
    }
  }

  // 6. Country profiles
  const cellsOf: number[][] = seeds.map(() => []);
  for (let i = 0; i < n; i++) if (owner[i]! >= 0) cellsOf[owner[i]!]!.push(i);

  const countries: Country[] = [];
  for (let c = 0; c < countryCount; c++) {
    const def = COUNTRY_DEFS[c];
    if (!def) throw new Error(`No country definition for index ${c}`);
    const cells = cellsOf[c]!;
    const profile = ARCHETYPES[def.archetype];

    let cx = 0;
    let cy = 0;
    for (const i of cells) {
      cx += points[i]![0];
      cy += points[i]![1];
    }
    cx /= cells.length;
    cy /= cells.length;
    let capitalCell = cells[0]!;
    let bestDist = Infinity;
    for (const i of cells) {
      const d = (points[i]![0] - cx) ** 2 + (points[i]![1] - cy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        capitalCell = i;
      }
    }

    const area = cells.length;
    const population = Math.round(
      area * POPULATION_PER_CELL * profile.density * rng.range(0.85, 1.15),
    );
    const gdpPerCapita = Math.round(
      profile.gdpPerCapita * rng.range(0.85, 1.15),
    );
    countries.push({
      id: c,
      name: def.name,
      region: LAND_MASSES[countryMass[c]!]!.name,
      capital: {
        name: def.capital,
        x: points[capitalCell]![0],
        y: points[capitalCell]![1],
      },
      color: def.color,
      governmentType: def.governmentType,
      archetype: profile.label,
      area,
      population,
      gdp: population * gdpPerCapita,
      gdpPerCapita,
      debtPercentGdp: Math.round(
        rng.range(profile.debt[0], profile.debt[1]) * 100,
      ),
      approval: Math.round(rng.range(profile.approval[0], profile.approval[1])),
      stability: Math.round(
        rng.range(profile.stability[0], profile.stability[1]),
      ),
      armyPersonnel: Math.round(
        population * profile.militaryRate * rng.range(0.8, 1.2),
      ),
    });
  }

  // 7. Output
  const cells: WorldCell[] = [];
  for (let i = 0; i < n; i++) {
    if (owner[i]! >= 0)
      cells.push({ polygon: polygons[i]!, countryId: owner[i]! });
  }
  const sites: number[] = [];
  for (const p of points) sites.push(p[0], p[1]);

  return {
    seed,
    width,
    height,
    countries,
    cells,
    segments,
    sites,
    siteOwner: owner,
  };
}
