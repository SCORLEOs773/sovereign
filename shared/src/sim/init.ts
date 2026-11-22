import { generateWorld } from "../world/generateWorld";
import { createInitialRelations } from "./diplomacy";
import { pushEvent } from "./events";
import { recordHistory } from "./history";
import { createNation } from "./nations";
import { createEmptyHistory, type SimState } from "./state";

/** Create the starting state of a new campaign for the chosen nation. */
export function createInitialSimState(
  seed: number,
  playerCountryId: number,
): SimState {
  const world = generateWorld(seed);
  const nations = world.countries.map((country) => createNation(country, seed));
  const player = nations[playerCountryId];
  if (!player) throw new Error(`Unknown country id ${playerCountryId}`);

  const state: SimState = {
    tick: 0,
    hours: 0,
    days: 0,
    months: 0,
    seed,
    playerCountryId,
    nations,
    events: [],
    alerts: {},
    history: createEmptyHistory(),
    gameOver: null,
    relations: createInitialRelations(seed, nations),
    treaties: [],
    sanctions: [],
    proposals: [],
    pendingDecision: null,
    nextId: 1,
    electionsWon: 0,
    startGdp: player.gdp,
  };

  pushEvent(
    state,
    "info",
    `You have taken office as the leader of ${player.name}.`,
  );
  recordHistory(state, player);
  return state;
}
