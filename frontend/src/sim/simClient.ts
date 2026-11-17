import type {
  PolicyPatch,
  SimCommand,
  SimEvent,
  SimSnapshot,
  SimSpeed,
} from "@sovereign/shared";
import { useGameStore } from "../store/gameStore";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { clearAutosave, loadAutosave, saveAutosave } from "./saveStore";

const AUTOSAVE_INTERVAL_MS = 10_000;

let worker: Worker | null = null;
let pendingSnapshot: SimSnapshot | null = null;
let gameOverHandled = false;

function send(command: SimCommand): void {
  worker?.postMessage(command);
}

export async function saveNow(): Promise<void> {
  const sim = useSimStore.getState();
  if (!sim.ready || !sim.state || sim.state.gameOver) return;
  const snapshot: SimSnapshot = {
    version: 2,
    worldSeed: sim.state.seed,
    speed: sim.speed,
    state: sim.state,
    savedAt: Date.now(),
  };
  try {
    await saveAutosave(snapshot);
  } catch (err) {
    console.error("Autosave failed", err);
  }
}

/** Start the simulation worker and look for an existing save. Safe to call twice. */
export async function bootstrap(): Promise<void> {
  if (worker) return;
  worker = new Worker(new URL("./sim.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent<SimEvent>) => {
    useSimStore.getState().applyEvent(event.data);
    if (event.data.state.gameOver && !gameOverHandled) {
      gameOverHandled = true;
      pendingSnapshot = null;
      void clearAutosave().catch(() => undefined);
      useUiStore.getState().setHasSave(false);
    }
  };

  pendingSnapshot = await loadAutosave().catch(() => null);
  useUiStore.getState().setHasSave(pendingSnapshot !== null);

  window.setInterval(() => void saveNow(), AUTOSAVE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void saveNow();
  });
  window.addEventListener("pagehide", () => void saveNow());
}

export function continueCampaign(): void {
  const snapshot = pendingSnapshot;
  if (!snapshot) return;
  gameOverHandled = false;
  useGameStore.getState().setWorldSeed(snapshot.worldSeed);
  useGameStore.getState().selectCountry(snapshot.state.playerCountryId);
  send({
    type: "init",
    worldSeed: snapshot.worldSeed,
    playerCountryId: null,
    snapshot,
    offlineSeconds: Math.max(0, (Date.now() - snapshot.savedAt) / 1000),
  });
  useUiStore.getState().setScreen("game");
}

export function startCampaign(countryId: number): void {
  const seed = useGameStore.getState().world.seed;
  gameOverHandled = false;
  pendingSnapshot = null;
  void clearAutosave().catch(() => undefined);
  useGameStore.getState().selectCountry(countryId);
  send({
    type: "init",
    worldSeed: seed,
    playerCountryId: countryId,
    snapshot: null,
    offlineSeconds: 0,
  });
  useUiStore.getState().setHasSave(true);
  useUiStore.getState().setScreen("game");
  window.setTimeout(() => void saveNow(), 500);
}

export async function backToMenu(): Promise<void> {
  send({ type: "setSpeed", speed: 0 });
  await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
  await saveNow();
  pendingSnapshot = await loadAutosave().catch(() => null);
  useUiStore.getState().setHasSave(pendingSnapshot !== null);
  useUiStore.getState().setScreen("menu");
}

export function setSpeed(speed: SimSpeed): void {
  send({ type: "setSpeed", speed });
  window.setTimeout(() => void saveNow(), 150);
}

export function setPolicy(patch: PolicyPatch): void {
  useSimStore.getState().patchPolicy(patch);
  send({ type: "setPolicy", policy: patch });
}
