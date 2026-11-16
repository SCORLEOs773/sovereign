import { Delaunay } from "d3-delaunay";
import type { World } from "./types";

/** Returns a function that maps a world coordinate to a country id (-1 for water). */
export function createCountryPicker(
  world: World,
): (x: number, y: number) => number {
  const points: [number, number][] = [];
  for (let i = 0; i < world.sites.length; i += 2) {
    points.push([world.sites[i]!, world.sites[i + 1]!]);
  }
  const delaunay = Delaunay.from(points);
  return (x, y) => {
    if (x < 0 || y < 0 || x > world.width || y > world.height) return -1;
    const index = delaunay.find(x, y);
    return world.siteOwner[index] ?? -1;
  };
}
