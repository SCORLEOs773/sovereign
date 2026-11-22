import { useCallback, useEffect, useRef } from "react";
import { createMapController, type MapController } from "../map/mapController";
import { computeMapColors, mapColorKey } from "../map/mapColors";
import { useGameStore } from "../store/gameStore";
import { useSimStore } from "../store/simStore";
import { useUiStore, type MapMode } from "../store/uiStore";

const MODES: { id: MapMode; label: string }[] = [
  { id: "political", label: "Political" },
  { id: "relations", label: "Relations" },
  { id: "economy", label: "Economy" },
];

export function WorldMap({ showModes = false }: { showModes?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const world = useGameStore((s) => s.world);
  const hoveredName = useGameStore((s) =>
    s.hoveredCountryId === null
      ? null
      : (s.world.countries.find((c) => c.id === s.hoveredCountryId)?.name ??
        null),
  );
  const mode = useUiStore((s) => s.mapMode);
  const setMode = useUiStore((s) => s.setMapMode);
  const effectiveMode: MapMode = showModes ? mode : "political";
  const colorKey = useSimStore((s) => mapColorKey(effectiveMode, s.state));

  const applyColors = useCallback((): void => {
    controllerRef.current?.setColors(
      computeMapColors(effectiveMode, world, useSimStore.getState().state),
    );
  }, [effectiveMode, world]);

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
        applyColors();
      })
      .catch((err: unknown) => console.error("Failed to start the map", err));

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
    // The map is rebuilt only when the world changes. Colours are updated separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => {
    applyColors();
  }, [applyColors, colorKey]);

  return (
    <section className="map-area">
      <div ref={hostRef} className="map-host" />
      {hoveredName && <div className="map-hover">{hoveredName}</div>}

      {showModes && (
        <div className="map-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode ${mode === m.id ? "active" : ""}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {showModes && mode === "relations" && (
        <div className="map-legend">
          <div>How nations feel about you</div>
          <div className="legend-bar relations" />
          <div className="legend-ends">
            <span>Hostile</span>
            <span>Friendly</span>
          </div>
        </div>
      )}
      {showModes && mode === "economy" && (
        <div className="map-legend">
          <div>GDP per capita</div>
          <div className="legend-bar economy" />
          <div className="legend-ends">
            <span>Poorer</span>
            <span>Richer</span>
          </div>
        </div>
      )}

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
