import {
  SimCommandSchema,
  SimulationEngine,
  computeOfflineTicks,
  type SimEvent,
} from "@sovereign/shared";

interface WorkerScope {
  postMessage: (message: SimEvent) => void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
}
const scope = self as unknown as WorkerScope;

const LOOP_INTERVAL_MS = 50;

let engine: SimulationEngine | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastTime = 0;

function postState(): void {
  if (!engine) return;
  scope.postMessage({
    type: "state",
    speed: engine.getSpeed(),
    state: engine.getState(),
  });
}

function loop(): void {
  if (!engine) return;
  const now = performance.now();
  const delta = now - lastTime;
  lastTime = now;
  if (engine.advance(delta) > 0) postState();
}

scope.onmessage = (event) => {
  const parsed = SimCommandSchema.safeParse(event.data);
  if (!parsed.success) {
    console.error("Invalid simulation command", parsed.error);
    return;
  }
  const command = parsed.data;

  if (command.type === "init") {
    if (timer !== null) clearInterval(timer);

    engine = new SimulationEngine(
      command.snapshot ? command.snapshot.state : undefined,
    );
    let offline = {
      ticks: 0,
      capped: false,
      elapsedSeconds: command.offlineSeconds,
    };

    if (command.snapshot) {
      engine.setSpeed(command.snapshot.speed);
      const progress = computeOfflineTicks(
        command.offlineSeconds,
        command.snapshot.speed,
      );
      engine.fastForward(progress.ticks);
      offline = { ...progress, elapsedSeconds: command.offlineSeconds };
    }

    scope.postMessage({
      type: "ready",
      worldSeed: command.worldSeed,
      speed: engine.getSpeed(),
      state: engine.getState(),
      offline,
    });

    lastTime = performance.now();
    timer = setInterval(loop, LOOP_INTERVAL_MS);
  } else {
    if (!engine) return;
    engine.setSpeed(command.speed);
    postState();
  }
};
