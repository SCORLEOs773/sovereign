import { useEffect, useRef } from "react";
import { createMapController, type MapController } from "../map/mapController";
import { useGameStore } from "../store/gameStore";

export function WorldMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const world = useGameStore((s) => s.world);
  const hoveredName = useGameStore((s) =>
    s.hoveredCountryId === null
      ? null
      : (s.world.countries.find((c) => c.id === s.hoveredCountryId)?.name ??
        null),
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    createMapController(host, world)
      .then((controller) => {
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
      })
      .catch((err: unknown) => console.error("Failed to start the map", err));

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [world]);

  return (
    <section className="map-area">
      <div ref={hostRef} className="map-host" />
      {hoveredName && <div className="map-hover">{hoveredName}</div>}
      <div className="map-controls">
        <button
          onClick={() => controllerRef.current?.zoomBy(1.4)}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => controllerRef.current?.zoomBy(1 / 1.4)}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => controllerRef.current?.resetView()}
          aria-label="Reset view"
        >
          ⌂
        </button>
      </div>
    </section>
  );
}
