import type {
  SimCommand,
  SimEvent,
  SimSnapshot,
  SimSpeed,
} from "@sovereign/shared";
import { useGameStore } from "../store/gameStore";
import { useSimStore } from "../store/simStore";
import { clearAutosave, loadAutosave, saveAutosave } from "./saveStore";

const AUTOSAVE_INTERVAL_MS = 10_000;

let worker: Worker | null = null;

function send(command: SimCommand): void {
  worker?.postMessage(command);
}

export function saveNow(): void {
  const sim = useSimStore.getState();
  if (!sim.ready) return;
  const snapshot: SimSnapshot = {
    version: 1,
    worldSeed: useGameStore.getState().world.seed,
    speed: sim.speed,
    state: sim.state,
    savedAt: Date.now(),
  };
  saveAutosave(snapshot).catch((err: unknown) =>
    console.error("Autosave failed", err),
  );
}

export async function startSimulation(): Promise<void> {
  if (worker) return;
  worker = new Worker(new URL("./sim.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent<SimEvent>) => {
    useSimStore.getState().applyEvent(event.data);
  };

  const snapshot = await loadAutosave().catch(() => null);
  if (snapshot) {
    useGameStore.getState().setWorldSeed(snapshot.worldSeed);
    send({
      type: "init",
      worldSeed: snapshot.worldSeed,
      snapshot,
      offlineSeconds: Math.max(0, (Date.now() - snapshot.savedAt) / 1000),
    });
  } else {
    send({
      type: "init",
      worldSeed: useGameStore.getState().world.seed,
      snapshot: null,
      offlineSeconds: 0,
    });
  }

  window.setInterval(saveNow, AUTOSAVE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveNow();
  });
  window.addEventListener("pagehide", saveNow);
}

export function setSpeed(speed: SimSpeed): void {
  send({ type: "setSpeed", speed });
  window.setTimeout(saveNow, 150);
}

/** Dev helper: roll a new world and restart the clock from the beginning. */
export function startNewCampaign(): void {
  useGameStore.getState().regenerateWorld();
  void clearAutosave().catch(() => undefined);
  send({
    type: "init",
    worldSeed: useGameStore.getState().world.seed,
    snapshot: null,
    offlineSeconds: 0,
  });
  window.setTimeout(saveNow, 300);
}
