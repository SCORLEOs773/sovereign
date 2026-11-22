import { militaryPower, type SimState, type World } from "@sovereign/shared";

export interface WarOverlay {
  occupations: { holder: number; victim: number; fraction: number }[];
  arrows: { x1: number; y1: number; x2: number; y2: number }[];
}

export interface ArmyCircle {
  x: number;
  y: number;
  power: number;
}

export function computeWarOverlay(
  world: World,
  state: SimState | null,
): WarOverlay {
  const overlay: WarOverlay = { occupations: [], arrows: [] };
  if (!state) return overlay;

  const capital = (id: number): { x: number; y: number } | null =>
    world.countries.find((c) => c.id === id)?.capital ?? null;

  for (const war of state.wars) {
    for (const o of war.occupations) overlay.occupations.push({ ...o });

    const attackerTarget = capital(war.defenders[0]!);
    const defenderTarget = capital(war.attackers[0]!);
    for (const id of war.attackers) {
      const from = capital(id);
      if (from && attackerTarget) {
        overlay.arrows.push({
          x1: from.x,
          y1: from.y,
          x2: attackerTarget.x,
          y2: attackerTarget.y,
        });
      }
    }
    // A counter-arrow shows the defenders striking back once they hold ground
    const pushedBack = war.occupations.some(
      (o) => o.holder === war.defenders[0],
    );
    if (pushedBack) {
      const from = capital(war.defenders[0]!);
      if (from && defenderTarget) {
        overlay.arrows.push({
          x1: from.x,
          y1: from.y,
          x2: defenderTarget.x,
          y2: defenderTarget.y,
        });
      }
    }
  }
  return overlay;
}

/** Changes only when the war picture would look different. */
export function warOverlayKey(state: SimState | null): string {
  if (!state || state.wars.length === 0) return "peace";
  return state.wars
    .map(
      (w) =>
        `${w.id}:${w.attackers.join(",")}>${w.defenders.join(",")}:` +
        w.occupations
          .map((o) => `${o.holder}>${o.victim}=${Math.round(o.fraction * 50)}`)
          .join("|"),
    )
    .join(";");
}

export function computeArmyCircles(state: SimState | null): ArmyCircle[] {
  if (!state) return [];
  return state.nations.map((n) => ({
    x: n.x,
    y: n.y,
    power: militaryPower(n),
  }));
}
