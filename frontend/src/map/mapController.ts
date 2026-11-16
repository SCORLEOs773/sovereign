import { Application, Container, Graphics, Text } from "pixi.js";
import {
  createCountryPicker,
  type Country,
  type World,
} from "@sovereign/shared";
import { useGameStore } from "../store/gameStore";

const OCEAN_BACKGROUND = 0x0b1a2c;
const OCEAN_WORLD = 0x12304f;

export interface MapController {
  zoomBy: (factor: number) => void;
  resetView: () => void;
  destroy: () => void;
}

function lighten(color: number, amount: number): number {
  const mix = (c: number): number => Math.round(c + (255 - c) * amount);
  const r = mix((color >> 16) & 255);
  const g = mix((color >> 8) & 255);
  const b = mix(color & 255);
  return (r << 16) | (g << 8) | b;
}

export async function createMapController(
  host: HTMLElement,
  world: World,
): Promise<MapController> {
  const app = new Application();
  await app.init({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    background: OCEAN_BACKGROUND,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  const canvas = app.canvas;
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  host.appendChild(canvas);

  // We handle input ourselves, so turn off Pixi's event system for the scene.
  app.stage.eventMode = "none";
  app.stage.interactiveChildren = false;

  const picker = createCountryPicker(world);
  const countryById = new Map<number, Country>(
    world.countries.map((c) => [c.id, c] as [number, Country]),
  );

  // ---------- Scene ----------
  const viewport = new Container();
  app.stage.addChild(viewport);

  const ocean = new Graphics()
    .rect(0, 0, world.width, world.height)
    .fill(OCEAN_WORLD);

  const land = new Graphics();
  const polysByCountry = new Map<number, number[][]>();
  for (const cell of world.cells) {
    const country = countryById.get(cell.countryId);
    if (!country) continue;
    land
      .poly(cell.polygon)
      .fill({ color: country.color })
      .stroke({ width: 0.8, color: country.color });
    const list = polysByCountry.get(cell.countryId);
    if (list) list.push(cell.polygon);
    else polysByCountry.set(cell.countryId, [cell.polygon]);
  }

  const hoverFill = new Graphics();
  const selectFill = new Graphics();

  const borders = new Graphics();
  const coasts = new Graphics();
  for (const s of world.segments) {
    const g = s.b === -1 ? coasts : borders;
    g.moveTo(s.x1, s.y1).lineTo(s.x2, s.y2);
  }
  borders.stroke({ width: 1.4, color: 0x0b1220, alpha: 0.6, cap: "round" });
  coasts.stroke({ width: 1.2, color: 0x081624, alpha: 0.95, cap: "round" });

  const selectOutline = new Graphics();

  const markers: Graphics[] = [];
  const labels: Text[] = [];
  const markerLayer = new Container();
  const labelLayer = new Container();
  for (const country of world.countries) {
    const marker = new Graphics()
      .circle(0, 0, 3.5)
      .fill(0xffffff)
      .stroke({ width: 1.5, color: 0x0b1220 });
    marker.position.set(country.capital.x, country.capital.y);
    markerLayer.addChild(marker);
    markers.push(marker);

    const label = new Text({
      text: country.name,
      style: {
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: 26,
        fontWeight: "600",
        fill: 0xffffff,
        letterSpacing: 1,
        stroke: { color: 0x061320, width: 5 },
      },
    });
    label.anchor.set(0.5, -0.8);
    label.position.set(country.capital.x, country.capital.y);
    labelLayer.addChild(label);
    labels.push(label);
  }

  viewport.addChild(
    ocean,
    land,
    hoverFill,
    selectFill,
    borders,
    coasts,
    selectOutline,
    markerLayer,
    labelLayer,
  );

  // ---------- Highlights ----------
  const fillCountry = (g: Graphics, id: number, amount: number): void => {
    const country = countryById.get(id);
    if (!country) return;
    const color = lighten(country.color, amount);
    for (const poly of polysByCountry.get(id) ?? []) {
      g.poly(poly).fill({ color }).stroke({ width: 0.8, color });
    }
  };

  const redrawHighlights = (): void => {
    const { hoveredCountryId, selectedCountryId } = useGameStore.getState();
    hoverFill.clear();
    selectFill.clear();
    selectOutline.clear();

    if (hoveredCountryId !== null && hoveredCountryId !== selectedCountryId) {
      fillCountry(hoverFill, hoveredCountryId, 0.2);
    }
    if (selectedCountryId !== null) {
      fillCountry(selectFill, selectedCountryId, 0.35);
      let any = false;
      for (const s of world.segments) {
        if (s.a === selectedCountryId || s.b === selectedCountryId) {
          selectOutline.moveTo(s.x1, s.y1).lineTo(s.x2, s.y2);
          any = true;
        }
      }
      if (any) {
        selectOutline.stroke({
          width: 2.4,
          color: 0xffffff,
          alpha: 0.95,
          cap: "round",
          join: "round",
        });
      }
    }
  };

  const unsubscribe = useGameStore.subscribe((state, prev) => {
    if (
      state.hoveredCountryId !== prev.hoveredCountryId ||
      state.selectedCountryId !== prev.selectedCountryId
    ) {
      redrawHighlights();
    }
  });

  // ---------- View (zoom and pan) ----------
  let scale = 1;
  let fitScale = 1;
  let ox = 0;
  let oy = 0;
  let userMoved = false;

  const minScale = (): number => fitScale * 0.7;
  const maxScale = (): number => fitScale * 14;

  const applyView = (): void => {
    const margin = 120;
    const contentW = world.width * scale;
    const contentH = world.height * scale;
    ox = Math.min(app.screen.width - margin, Math.max(margin - contentW, ox));
    oy = Math.min(app.screen.height - margin, Math.max(margin - contentH, oy));
    viewport.position.set(ox, oy);
    viewport.scale.set(scale);
    for (const m of markers) m.scale.set(1 / scale);
    for (const l of labels) l.scale.set(0.5 / scale);
  };

  const fit = (): void => {
    fitScale =
      Math.min(
        app.screen.width / world.width,
        app.screen.height / world.height,
      ) * 0.96;
    scale = fitScale;
    ox = (app.screen.width - world.width * scale) / 2;
    oy = (app.screen.height - world.height * scale) / 2;
    applyView();
  };

  const zoomAt = (factor: number, sx: number, sy: number): void => {
    const next = Math.min(maxScale(), Math.max(minScale(), scale * factor));
    const wx = (sx - ox) / scale;
    const wy = (sy - oy) / scale;
    scale = next;
    ox = sx - wx * scale;
    oy = sy - wy * scale;
    userMoved = true;
    applyView();
  };

  // ---------- Input ----------
  const pointerToWorld = (
    e: PointerEvent | WheelEvent,
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - ox) / scale,
      y: (e.clientY - rect.top - oy) / scale,
    };
  };

  const pickAt = (e: PointerEvent): number => {
    const p = pointerToWorld(e);
    return picker(p.x, p.y);
  };

  const updateHover = (e: PointerEvent): void => {
    const id = pickAt(e);
    const next = id >= 0 ? id : null;
    const store = useGameStore.getState();
    if (store.hoveredCountryId !== next) store.hoverCountry(next);
    canvas.style.cursor = next !== null ? "pointer" : "grab";
  };

  let pressed = false;
  let dragged = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(
      Math.exp(-e.deltaY * 0.0015),
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
  };

  const onPointerDown = (e: PointerEvent): void => {
    pressed = true;
    dragged = false;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (pressed) {
      if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 4) {
        dragged = true;
        canvas.style.cursor = "grabbing";
      }
      if (dragged) {
        ox += e.clientX - lastX;
        oy += e.clientY - lastY;
        userMoved = true;
        applyView();
      }
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    updateHover(e);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!pressed) return;
    pressed = false;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (!dragged) {
      const id = pickAt(e);
      useGameStore.getState().selectCountry(id >= 0 ? id : null);
    }
    updateHover(e);
  };

  const onPointerCancel = (): void => {
    pressed = false;
  };

  const onPointerLeave = (): void => {
    if (!pressed) useGameStore.getState().hoverCountry(null);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") useGameStore.getState().selectCountry(null);
  };

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);

  const observer = new ResizeObserver(() => {
    app.renderer.resize(
      Math.max(1, host.clientWidth),
      Math.max(1, host.clientHeight),
    );
    if (userMoved) applyView();
    else fit();
  });
  observer.observe(host);

  fit();
  redrawHighlights();

  return {
    zoomBy: (factor) =>
      zoomAt(factor, app.screen.width / 2, app.screen.height / 2),
    resetView: () => {
      userMoved = false;
      fit();
    },
    destroy: () => {
      observer.disconnect();
      unsubscribe();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
