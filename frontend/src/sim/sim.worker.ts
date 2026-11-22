import {
  SimCommandSchema,
  SimulationEngine,
  computeOfflineTicks,
  createInitialSimState,
  type SimEvent,
  type SimState,
} from "@sovereign/shared";

interface WorkerScope {
  postMessage: (message: SimEvent) => void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
}
const scope = self as unknown as WorkerScope;

const LOOP_INTERVAL_MS = 50;
const POST_INTERVAL_MS = 200;

let engine: SimulationEngine | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastTime = 0;
let lastPost = 0;

function postState(force: boolean): void {
  if (!engine) return;
  const now = performance.now();
  if (!force && now - lastPost < POST_INTERVAL_MS) return;
  lastPost = now;
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
  const ran = engine.advance(delta);
  if (ran > 0) {
    const state = engine.getState();
    // Post straight away when the player needs to react
    postState(state.gameOver !== null || state.pendingDecision !== null);
  }
}

scope.onmessage = (event) => {
  const parsed = SimCommandSchema.safeParse(event.data);
  if (!parsed.success) {
    console.error("Invalid simulation command", parsed.error);
    return;
  }
  const command = parsed.data;

  if (command.type === "init") {
    let initial: SimState;
    if (command.snapshot) {
      initial = command.snapshot.state;
    } else if (command.playerCountryId !== null) {
      initial = createInitialSimState(
        command.worldSeed,
        command.playerCountryId,
      );
    } else {
      console.error("init needs either a snapshot or a player country");
      return;
    }

    if (timer !== null) clearInterval(timer);
    engine = new SimulationEngine(initial);
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
    lastPost = lastTime;
    timer = setInterval(loop, LOOP_INTERVAL_MS);
    return;
  }

  if (!engine) return;
  switch (command.type) {
    case "setSpeed":
      engine.setSpeed(command.speed);
      break;
    case "setPolicy":
      engine.applyPolicy(command.policy);
      break;
    case "resolveDecision":
      engine.resolveDecision(command.optionId);
      break;
    case "improveRelations":
      engine.improveRelations(command.target);
      break;
    case "proposeTreaty":
      engine.proposeTreaty(command.target, command.kind);
      break;
    case "cancelTreaty":
      engine.cancelTreaty(command.treatyId);
      break;
    case "setSanctions":
      engine.setSanctions(command.target, command.active);
      break;
    case "respondProposal":
      engine.respondProposal(command.proposalId, command.accept);
      break;
    case "declareWar":
      engine.declareWar(command.target);
      break;
    case "proposePeace":
      engine.proposePeace(command.warId);
      break;
    case "demandSurrender":
      engine.demandSurrender(command.warId);
      break;
  }
  postState(true);
};
