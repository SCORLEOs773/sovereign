import { Application, Container, Graphics, Text } from "pixi.js";
import {
  createCountryPicker,
  type Country,
  type World,
} from "@sovereign/shared";
import { useGameStore } from "../store/gameStore";
import type { ArmyCircle, WarOverlay } from "./warOverlay";

const OCEAN_BACKGROUND = 0x0b1a2c;
const OCEAN_WORLD = 0x12304f;
const WAR_RED = 0xff5a4a;

export interface MapController {
  zoomBy: (factor: number) => void;
  resetView: () => void;
  /** Recolour countries, for example for the relations or economy map modes */
  setColors: (colors: Map<number, number>) => void;
  /** Occupied territory, front-line battles and war arrows */
  setWarOverlay: (overlay: WarOverlay) => void;
  /** Circles at the capitals sized by military power (military map mode) */
  setArmyCircles: (circles: ArmyCircle[]) => void;
  destroy: () => void;
}

interface CellInfo {
  poly: number[];
  x: number;
  y: number;
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
  const colors = new Map<number, number>(
    world.countries.map((c) => [c.id, c.color] as [number, number]),
  );
  const colorOf = (id: number): number => colors.get(id) ?? 0x888888;

  // ---------- Scene ----------
  const viewport = new Container();
  app.stage.addChild(viewport);

  const ocean = new Graphics()
    .rect(0, 0, world.width, world.height)
    .fill(OCEAN_WORLD);

  const land = new Graphics();
  const polysByCountry = new Map<number, number[][]>();
  const cellsByCountry = new Map<number, CellInfo[]>();
  for (const cell of world.cells) {
    const list = polysByCountry.get(cell.countryId);
    if (list) list.push(cell.polygon);
    else polysByCountry.set(cell.countryId, [cell.polygon]);

    let cx = 0;
    let cy = 0;
    const count = cell.polygon.length / 2;
    for (let i = 0; i < cell.polygon.length; i += 2) {
      cx += cell.polygon[i]!;
      cy += cell.polygon[i + 1]!;
    }
    const info: CellInfo = { poly: cell.polygon, x: cx / count, y: cy / count };
    const infos = cellsByCountry.get(cell.countryId);
    if (infos) infos.push(info);
    else cellsByCountry.set(cell.countryId, [info]);
  }

  const drawLand = (): void => {
    land.clear();
    for (const cell of world.cells) {
      const color = colorOf(cell.countryId);
      land.poly(cell.polygon).fill({ color }).stroke({ width: 0.8, color });
    }
  };
  drawLand();

  const occupationLayer = new Graphics();
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
  const armyLayer = new Container();
  const warLayer = new Graphics();

  const markers: Graphics[] = [];
  const labels: Text[] = [];
  const markerLayer = new Container();
  const battleLayer = new Container();
  const labelLayer = new Container();
  for (const country of countryById.values()) {
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
    occupationLayer,
    hoverFill,
    selectFill,
    borders,
    coasts,
    selectOutline,
    armyLayer,
    warLayer,
    markerLayer,
    battleLayer,
    labelLayer,
  );

  // ---------- Highlights ----------
  const fillCountry = (g: Graphics, id: number, amount: number): void => {
    const color = lighten(colorOf(id), amount);
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

  // ---------- War visuals ----------
  const sortedCells = new Map<string, CellInfo[]>();
  /** The victim's cells ordered from the side nearest the invader's capital. */
  const cellsNear = (victim: number, holder: number): CellInfo[] => {
    const key = `${victim}:${holder}`;
    let list = sortedCells.get(key);
    if (!list) {
      list = [...(cellsByCountry.get(victim) ?? [])];
      const cap = countryById.get(holder)?.capital;
      if (cap) {
        list.sort(
          (a, b) =>
            Math.hypot(a.x - cap.x, a.y - cap.y) -
            Math.hypot(b.x - cap.x, b.y - cap.y),
        );
      }
      sortedCells.set(key, list);
    }
    return list;
  };

  const battleMarkers: { g: Graphics; phase: number }[] = [];

  const setWarOverlay = (overlay: WarOverlay): void => {
    occupationLayer.clear();
    warLayer.clear();
    for (const m of battleMarkers) m.g.destroy();
    battleMarkers.length = 0;

    for (const occupation of overlay.occupations) {
      const cells = cellsNear(occupation.victim, occupation.holder);
      const count = Math.min(
        cells.length,
        Math.round(occupation.fraction * cells.length),
      );
      const color = countryById.get(occupation.holder)?.color ?? 0xffffff;

      for (let i = 0; i < count; i++) {
        const cell = cells[i]!;
        occupationLayer
          .poly(cell.poly)
          .fill({ color, alpha: 0.82 })
          .stroke({ width: 1.2, color: 0xffffff, alpha: 0.3 });
      }

      // Battles rage along the front line
      const frontier = cells.slice(Math.max(0, count - 4), count);
      frontier.forEach((cell, index) => {
        const g = new Graphics()
          .circle(0, 0, 6)
          .fill({ color: WAR_RED, alpha: 0.9 })
          .stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        g.position.set(cell.x, cell.y);
        battleLayer.addChild(g);
        battleMarkers.push({ g, phase: index * 1.3 + occupation.victim });
      });
    }

    for (const arrow of overlay.arrows) {
      const dx = arrow.x2 - arrow.x1;
      const dy = arrow.y2 - arrow.y1;
      const length = Math.hypot(dx, dy);
      if (length < 40) continue;
      const ux = dx / length;
      const uy = dy / length;

      const dash = 14;
      const gap = 9;
      const end = length - 24;
      for (let d = 0; d < end; d += dash + gap) {
        const to = Math.min(d + dash, end);
        warLayer
          .moveTo(arrow.x1 + ux * d, arrow.y1 + uy * d)
          .lineTo(arrow.x1 + ux * to, arrow.y1 + uy * to);
      }
      warLayer.stroke({ width: 2.5, color: WAR_RED, alpha: 0.9, cap: "round" });

      const tipX = arrow.x2 - ux * 8;
      const tipY = arrow.y2 - uy * 8;
      const baseX = tipX - ux * 18;
      const baseY = tipY - uy * 18;
      warLayer
        .poly([
          tipX,
          tipY,
          baseX - uy * 8,
          baseY + ux * 8,
          baseX + uy * 8,
          baseY - ux * 8,
        ])
        .fill({ color: WAR_RED, alpha: 0.95 });
    }
  };

  const setArmyCircles = (circles: ArmyCircle[]): void => {
    for (const child of armyLayer.removeChildren()) child.destroy();
    const max = Math.max(1, ...circles.map((c) => c.power));
    for (const c of circles) {
      const radius = 6 + 28 * Math.sqrt(c.power / max);
      const g = new Graphics()
        .circle(c.x, c.y, radius)
        .fill({ color: 0xffffff, alpha: 0.22 })
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
      armyLayer.addChild(g);
    }
  };

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

  // Pulse the battle markers
  const pulse = (): void => {
    const t = performance.now() / 1000;
    for (const m of battleMarkers) {
      const wave = Math.sin(t * 3 + m.phase);
      m.g.scale.set((1 + 0.35 * wave) / scale);
      m.g.alpha = 0.75 + 0.25 * wave;
    }
  };
  app.ticker.add(pulse);

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
    setColors: (next) => {
      colors.clear();
      for (const [id, color] of next) colors.set(id, color);
      drawLand();
      redrawHighlights();
    },
    setWarOverlay,
    setArmyCircles,
    destroy: () => {
      observer.disconnect();
      unsubscribe();
      app.ticker.remove(pulse);
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
