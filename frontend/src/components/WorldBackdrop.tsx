import { useMemo } from "react";
import { toCssColor } from "../format";
import { useGameStore } from "../store/gameStore";

/** A softly drifting silhouette of the current world, used behind the menu and the intro. */
export function WorldBackdrop() {
  const world = useGameStore((s) => s.world);

  const paths = useMemo(() => {
    const byCountry = new Map<number, string>();
    for (const cell of world.cells) {
      const pts = cell.polygon;
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      d += "Z";
      byCountry.set(cell.countryId, (byCountry.get(cell.countryId) ?? "") + d);
    }
    return world.countries.map((c) => ({
      id: c.id,
      color: toCssColor(c.color),
      d: byCountry.get(c.id) ?? "",
    }));
  }, [world]);

  return (
    <svg
      className="backdrop"
      viewBox={`0 0 ${world.width} ${world.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill={p.color}
          stroke={p.color}
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}
