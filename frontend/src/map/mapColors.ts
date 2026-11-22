import type { SimState, World } from "@sovereign/shared";
import type { MapMode } from "../store/uiStore";

function mix(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const channel = (shift: number): number => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * k);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function relationColor(relation: number): number {
  const neutral = 0x7a7f8a;
  return relation >= 0
    ? mix(neutral, 0x3ddc97, relation / 70)
    : mix(neutral, 0xd9534f, -relation / 70);
}

/** A key that changes only when the map would look different, to avoid pointless redraws. */
export function mapColorKey(mode: MapMode, state: SimState | null): string {
  if (!state || mode === "political") return "political";
  if (mode === "relations") {
    const row = state.relations[state.playerCountryId] ?? [];
    return `r:${state.playerCountryId}:${row.map((v) => Math.round(v / 5)).join(",")}`;
  }
  return `e:${state.months}`;
}

export function computeMapColors(
  mode: MapMode,
  world: World,
  state: SimState | null,
): Map<number, number> {
  const colors = new Map<number, number>();
  for (const c of world.countries) colors.set(c.id, c.color);
  if (!state || mode === "political") return colors;

  if (mode === "relations") {
    const row = state.relations[state.playerCountryId] ?? [];
    for (const c of world.countries) {
      colors.set(
        c.id,
        c.id === state.playerCountryId
          ? 0x4f8cff
          : relationColor(row[c.id] ?? 0),
      );
    }
  } else {
    for (const n of state.nations) {
      const perCapita = n.gdp / n.population;
      const t = (Math.log10(Math.max(1000, perCapita)) - 3.3) / 1.7;
      colors.set(n.id, mix(0x1d3a5c, 0x3fd0c0, t));
    }
  }
  return colors;
}
