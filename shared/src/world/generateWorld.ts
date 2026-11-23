import { Delaunay } from "d3-delaunay";
import { createRng, mixSeed, type Rng } from "./random";
import { fbm } from "./noise";
import {
  ARCHETYPES,
  COUNTRY_DEFS,
  LAND_MASSES,
  type CountryDef,
} from "./countryData";
import { CONTINENT_NAMES, ISLAND_NAMES } from "./landNames";
import type { Country, Segment, World, WorldCell } from "./types";

export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 1000;
export const DEFAULT_WORLD_SEED = 2026;

const SITE_COUNT = 2000;
const RELAX_ITERATIONS = 2;
const LAND_THRESHOLD = 0.12;
const POPULATION_PER_CELL = 600_000;
const TOTAL_COUNTRIES = COUNTRY_DEFS.length;
const LAYOUT_ATTEMPTS = 40;
const CONTINENT_AREA = 470_000;
const MIN_CONTINENT_CELLS = 40;
const MIN_ISLAND_CELLS = 8;
const MIN_ARCHIPELAGO_CELLS = 10;

type Point = [number, number];
type Kind = "continent" | "island" | "archipelago";

interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
  cos: number;
  sin: number;
}

interface Landmass {
  kind: Kind;
  name: string;
  blobs: Blob[];
  /** Water blobs cut out of the land, such as inland seas */
  seas: Blob[];
}

interface Layout {
  landmasses: Landmass[];
  /** How jagged the coastlines are */
  ruggedness: number;
  /** How far the whole map is bent by noise before shapes are cut out */
  warp: number;
}

interface Obstacle {
  x: number;
  y: number;
  r: number;
}

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

// ---------- Voronoi cells ----------

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

/** Farthest-point sampling so country seeds are spread out. */
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

// ---------- Random landmass layouts ----------

function makeBlob(
  x: number,
  y: number,
  radius: number,
  aspect: number,
  rot: number,
): Blob {
  return {
    x,
    y,
    rx: radius / Math.sqrt(aspect),
    ry: radius * Math.sqrt(aspect),
    cos: Math.cos(rot),
    sin: Math.sin(rot),
  };
}

/** 1 at the centre of the ellipse, 0 on its edge, negative outside. */
function blobScore(b: Blob, x: number, y: number): number {
  const dx = x - b.x;
  const dy = y - b.y;
  const u = (dx * b.cos + dy * b.sin) / b.rx;
  const v = (-dx * b.sin + dy * b.cos) / b.ry;
  return 1 - Math.sqrt(u * u + v * v);
}

const reachOf = (b: Blob): number => Math.max(b.rx, b.ry);

function findSpot(
  rng: Rng,
  obstacles: Obstacle[],
  reach: number,
  gap: number,
  margin: number,
): Point | null {
  const minX = margin + reach;
  const maxX = WORLD_WIDTH - margin - reach;
  const minY = margin + reach;
  const maxY = WORLD_HEIGHT - margin - reach;
  if (maxX <= minX || maxY <= minY) return null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const x = rng.range(minX, maxX);
    const y = rng.range(minY, maxY);
    let ok = true;
    for (const o of obstacles) {
      if (Math.hypot(x - o.x, y - o.y) < o.r + reach + gap) {
        ok = false;
        break;
      }
    }
    if (ok) return [x, y];
  }
  return null;
}

/** Returns null when the pieces could not be placed without crowding. The caller then tries again. */
function randomLayout(rng: Rng): Layout | null {
  const continentCount = [2, 3, 3, 4][rng.int(4)]!;
  const shares: number[] = [];
  let totalShare = 0;
  for (let i = 0; i < continentCount; i++) {
    const share = rng.range(0.7, 1.4);
    shares.push(share);
    totalShare += share;
  }

  const continentNames = shuffled(rng, CONTINENT_NAMES);
  const islandNames = shuffled(rng, ISLAND_NAMES);
  let islandNameIndex = 0;

  const landmasses: Landmass[] = [];
  const spots: Obstacle[] = [];
  const obstacles: Obstacle[] = [];

  // Continents: an elongated, rotated main body, plus lobes and sometimes an inland sea
  for (let i = 0; i < continentCount; i++) {
    const area = (CONTINENT_AREA * shares[i]!) / totalShare;
    const radius = Math.sqrt(area / Math.PI) * 1.18;
    const aspect = rng.range(0.55, 1);
    const rot = rng.range(0, Math.PI);
    const reach = radius / Math.sqrt(aspect);

    const spot = findSpot(rng, spots, reach * 0.85, 30, 30);
    if (!spot) return null;
    const [x, y] = spot;
    spots.push({ x, y, r: reach * 0.85 });

    const blobs: Blob[] = [makeBlob(x, y, radius, aspect, rot)];
    const lobes = rng.int(4);
    for (let j = 0; j < lobes; j++) {
      const angle = rng.range(0, Math.PI * 2);
      const distance = radius * rng.range(0.45, 0.85);
      const size = radius * rng.range(0.3, 0.55);
      blobs.push(
        makeBlob(
          clamp(
            x + Math.cos(angle) * distance,
            size + 30,
            WORLD_WIDTH - size - 30,
          ),
          clamp(
            y + Math.sin(angle) * distance,
            size + 30,
            WORLD_HEIGHT - size - 30,
          ),
          size,
          rng.range(0.5, 1),
          rng.range(0, Math.PI),
        ),
      );
    }

    const seas: Blob[] = [];
    if (area > 150_000 && rng.next() < 0.4) {
      seas.push(
        makeBlob(
          x + rng.range(-0.25, 0.25) * radius,
          y + rng.range(-0.25, 0.25) * radius,
          radius * rng.range(0.14, 0.24),
          rng.range(0.6, 1),
          rng.range(0, Math.PI),
        ),
      );
    }

    for (const b of blobs) obstacles.push({ x: b.x, y: b.y, r: reachOf(b) });
    landmasses.push({
      kind: "continent",
      name: continentNames[i]!,
      blobs,
      seas,
    });
  }

  // Island nations
  const islandCount = 2 + rng.int(4);
  for (let k = 0; k < islandCount; k++) {
    const radius = rng.range(58, 100);
    const spot = findSpot(rng, obstacles, radius * 1.35, 55, 50);
    if (!spot) continue;
    const blob = makeBlob(
      spot[0],
      spot[1],
      radius,
      rng.range(0.55, 1),
      rng.range(0, Math.PI),
    );
    obstacles.push({ x: spot[0], y: spot[1], r: reachOf(blob) });
    landmasses.push({
      kind: "island",
      name: islandNames[islandNameIndex++ % islandNames.length]!,
      blobs: [blob],
      seas: [],
    });
  }

  // Archipelago nations: one country spread over several small islands
  const archipelagoCount = rng.next() < 0.6 ? (rng.next() < 0.25 ? 2 : 1) : 0;
  for (let k = 0; k < archipelagoCount; k++) {
    const spot = findSpot(rng, obstacles, 150, 55, 50);
    if (!spot) continue;
    const blobs: Blob[] = [];
    const pieces = 3 + rng.int(4);
    for (let j = 0; j < pieces; j++) {
      const angle = rng.range(0, Math.PI * 2);
      const distance = rng.range(0, 110);
      blobs.push(
        makeBlob(
          spot[0] + Math.cos(angle) * distance,
          spot[1] + Math.sin(angle) * distance,
          rng.range(26, 42),
          rng.range(0.6, 1),
          rng.range(0, Math.PI),
        ),
      );
    }
    obstacles.push({ x: spot[0], y: spot[1], r: 170 });
    landmasses.push({
      kind: "archipelago",
      name: islandNames[islandNameIndex++ % islandNames.length]!,
      blobs,
      seas: [],
    });
  }

  return {
    landmasses,
    ruggedness: rng.range(0.5, 0.9),
    warp: rng.range(30, 85),
  };
}

/** The old fixed map, used only if random layouts keep failing. */
function fallbackLayout(): Layout {
  return {
    landmasses: LAND_MASSES.map(
      (m): Landmass => ({
        kind: m.countries > 1 ? "continent" : "island",
        name: m.name,
        blobs: [makeBlob(m.x, m.y, m.r, 1, 0)],
        seas: [],
      }),
    ),
    ruggedness: 0.7,
    warp: 0,
  };
}

// ---------- Land mask ----------

/** For every cell, which landmass owns it (or -1 for water). */
function computeMask(
  layout: Layout,
  points: Point[],
  polygons: number[][],
  seed: number,
): number[] {
  const n = points.length;
  const massOf: number[] = new Array(n).fill(-1);
  const noiseSeed = seed & 0xffff;

  for (let i = 0; i < n; i++) {
    if (polygons[i]!.length === 0) continue;
    const [px, py] = points[i]!;

    // Bend the map so coastlines wander
    const wx =
      px + layout.warp * (fbm(px / 260, py / 260, noiseSeed + 7, 2) - 0.5) * 2;
    const wy =
      py +
      layout.warp *
        (fbm(px / 260 + 40, py / 260 + 40, noiseSeed + 13, 2) - 0.5) *
        2;

    let best = -Infinity;
    let bestMass = -1;
    for (let m = 0; m < layout.landmasses.length; m++) {
      for (const blob of layout.landmasses[m]!.blobs) {
        const score = blobScore(blob, wx, wy);
        if (score > best) {
          best = score;
          bestMass = m;
        }
      }
    }
    if (bestMass < 0) continue;

    const noise = fbm(px / 150, py / 150, noiseSeed, 3);
    if (best + (noise - 0.5) * layout.ruggedness <= LAND_THRESHOLD) continue;

    let flooded = false;
    for (const sea of layout.landmasses[bestMass]!.seas) {
      if (blobScore(sea, wx, wy) + (noise - 0.5) * 0.4 > 0.1) {
        flooded = true;
        break;
      }
    }
    if (!flooded) massOf[i] = bestMass;
  }
  return massOf;
}

/**
 * Drop stray fragments. Continents and single islands keep only their biggest piece.
 * Archipelagos keep every piece of at least two cells.
 */
function pruneComponents(
  massOf: number[],
  neighbors: number[][],
  multi: boolean[],
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

  const best: number[] = new Array(multi.length).fill(-1);
  for (let c = 0; c < compSize.length; c++) {
    const m = compMass[c]!;
    if (best[m] === -1 || compSize[c]! > compSize[best[m]!]!) best[m] = c;
  }

  for (let i = 0; i < n; i++) {
    const c = comp[i]!;
    if (c < 0) continue;
    const m = massOf[i]!;
    const keep = multi[m] ? compSize[c]! >= 2 : best[m] === c;
    if (!keep) massOf[i] = -1;
  }
}

/**
 * Decide how many countries each landmass holds. Islands and archipelagos get one each,
 * continents share the rest (at least two each). Returns null if the layout cannot hold 20.
 */
function allocateCountries(layout: Layout, massOf: number[]): number[] | null {
  const landmasses = layout.landmasses;
  const size = new Array<number>(landmasses.length).fill(0);
  for (const m of massOf) {
    if (m >= 0) size[m] = (size[m] ?? 0) + 1;
  }

  const counts = new Array<number>(landmasses.length).fill(0);
  const continents: number[] = [];
  let smallLandCountries = 0;

  for (let m = 0; m < landmasses.length; m++) {
    const kind = landmasses[m]!.kind;
    if (kind === "continent") {
      if (size[m]! < MIN_CONTINENT_CELLS) return null;
      continents.push(m);
    } else if (
      size[m]! >= (kind === "island" ? MIN_ISLAND_CELLS : MIN_ARCHIPELAGO_CELLS)
    ) {
      counts[m] = 1;
      smallLandCountries += 1;
    }
  }

  const remaining = TOTAL_COUNTRIES - smallLandCountries;
  if (continents.length === 0 || remaining < continents.length * 2) return null;

  const caps = continents.map((m) => Math.max(2, Math.floor(size[m]! / 10)));
  const k = continents.map(() => 2);
  let left = remaining - continents.length * 2;
  while (left > 0) {
    // Give the next country to the continent with the most land per country
    let best = -1;
    let bestValue = -1;
    for (let j = 0; j < continents.length; j++) {
      if (k[j]! >= caps[j]!) continue;
      const value = size[continents[j]!]! / k[j]!;
      if (value > bestValue) {
        bestValue = value;
        best = j;
      }
    }
    if (best < 0) return null;
    k[best] = k[best]! + 1;
    left -= 1;
  }
  continents.forEach((m, j) => {
    counts[m] = k[j]!;
  });
  return counts;
}

interface LandResult {
  layout: Layout;
  massOf: number[];
  counts: number[];
}

function tryLayout(
  layout: Layout,
  points: Point[],
  polygons: number[][],
  neighbors: number[][],
  seed: number,
): LandResult | null {
  const massOf = computeMask(layout, points, polygons, seed);
  pruneComponents(
    massOf,
    neighbors,
    layout.landmasses.map((l) => l.kind === "archipelago"),
  );
  const counts = allocateCountries(layout, massOf);
  if (!counts) return null;

  // Landmasses too small to be a country sink back into the sea
  for (let i = 0; i < massOf.length; i++) {
    const m = massOf[i]!;
    if (m >= 0 && counts[m] === 0) massOf[i] = -1;
  }
  return { layout, massOf, counts };
}

function buildLand(
  seed: number,
  points: Point[],
  polygons: number[][],
  neighbors: number[][],
): LandResult {
  for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt++) {
    const layout = randomLayout(createRng(mixSeed(seed, 101, attempt)));
    if (!layout) continue;
    const result = tryLayout(layout, points, polygons, neighbors, seed);
    if (result) return result;
  }
  const result = tryLayout(fallbackLayout(), points, polygons, neighbors, seed);
  if (!result) throw new Error("World generation failed");
  return result;
}

// ---------- Colours ----------

function colorDistance(a: number, b: number): number {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
  const db = (a & 255) - (b & 255);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Give every country a palette colour, keeping neighbours as different as possible. */
function assignColors(adjacent: Set<number>[], palette: number[]): number[] {
  const count = adjacent.length;
  const chosen: number[] = new Array(count).fill(-1);
  const used = new Set<number>();
  const order = Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => adjacent[b]!.size - adjacent[a]!.size,
  );

  for (const c of order) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let p = 0; p < palette.length; p++) {
      if (used.has(p)) continue;
      let nearest = Infinity;
      for (const nb of adjacent[c]!) {
        const q = chosen[nb]!;
        if (q >= 0)
          nearest = Math.min(nearest, colorDistance(palette[p]!, palette[q]!));
      }
      const score = nearest === Infinity ? 1000 : nearest;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = p;
      }
    }
    chosen[c] = bestIndex;
    used.add(bestIndex);
  }
  return chosen.map((p) => palette[p]!);
}

// ---------- The generator ----------

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

  // 2. A random planet: continents, islands and archipelagos
  const { layout, massOf, counts } = buildLand(
    seed,
    points,
    polygons,
    neighbors,
  );

  // 3. Seed the countries
  const owner: number[] = new Array(n).fill(-1);
  const seeds: number[] = [];
  const countryMass: number[] = [];
  const defOf: CountryDef[] = [];
  const fixed: boolean[] = [];

  const defsIsland = shuffled(
    rng,
    COUNTRY_DEFS.filter((d) => d.archetype === "island"),
  );
  const defsOther = shuffled(
    rng,
    COUNTRY_DEFS.filter((d) => d.archetype !== "island"),
  );
  const takeDef = (preferIsland: boolean): CountryDef => {
    const first = preferIsland ? defsIsland : defsOther;
    const second = preferIsland ? defsOther : defsIsland;
    const def = first.shift() ?? second.shift();
    if (!def) throw new Error("Not enough country definitions");
    return def;
  };

  for (let m = 0; m < layout.landmasses.length; m++) {
    const want = counts[m]!;
    if (want === 0) continue;
    const landmass = layout.landmasses[m]!;
    const cells: number[] = [];
    for (let i = 0; i < n; i++) if (massOf[i] === m) cells.push(i);

    if (landmass.kind === "archipelago") {
      // One country owns every island of the group
      const index = seeds.length;
      for (const cell of cells) owner[cell] = index;
      seeds.push(cells[0]!);
      countryMass.push(m);
      defOf.push(takeDef(true));
      fixed.push(true);
      continue;
    }

    for (const s of pickSeeds(rng, cells, points, want)) {
      owner[s] = seeds.length;
      seeds.push(s);
      countryMass.push(m);
      defOf.push(takeDef(landmass.kind === "island"));
      fixed.push(false);
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
  const done = fixed.map((isFixed) => isFixed);
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

  // 5. Colours that keep neighbours apart
  const adjacent: Set<number>[] = seeds.map(() => new Set<number>());
  for (let i = 0; i < n; i++) {
    const a = owner[i]!;
    if (a < 0) continue;
    for (const nb of neighbors[i]!) {
      const b = owner[nb]!;
      if (b >= 0 && b !== a) {
        adjacent[a]!.add(b);
        adjacent[b]!.add(a);
      }
    }
  }
  const colors = assignColors(
    adjacent,
    COUNTRY_DEFS.map((d) => d.color),
  );

  // 6. Borders and coastlines
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

  // 7. Country profiles
  const cellsOf: number[][] = seeds.map(() => []);
  for (let i = 0; i < n; i++) if (owner[i]! >= 0) cellsOf[owner[i]!]!.push(i);

  const countries: Country[] = [];
  for (let c = 0; c < countryCount; c++) {
    const def = defOf[c]!;
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
      region: layout.landmasses[countryMass[c]!]!.name,
      capital: {
        name: def.capital,
        x: points[capitalCell]![0],
        y: points[capitalCell]![1],
      },
      color: colors[c]!,
      governmentType: def.governmentType,
      archetype: profile.label,
      archetypeId: def.archetype,
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

  // 8. Output
  const cellsOut: WorldCell[] = [];
  for (let i = 0; i < n; i++) {
    if (owner[i]! >= 0)
      cellsOut.push({ polygon: polygons[i]!, countryId: owner[i]! });
  }
  const sites: number[] = [];
  for (const p of points) sites.push(p[0], p[1]);

  return {
    seed,
    width,
    height,
    countries,
    cells: cellsOut,
    segments,
    sites,
    siteOwner: owner,
  };
}
