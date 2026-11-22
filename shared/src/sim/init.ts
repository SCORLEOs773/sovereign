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

  // Which nations share a land border
  const adjacency: number[][] = world.countries.map(() => []);
  for (const segment of world.segments) {
    if (segment.b < 0) continue;
    if (!adjacency[segment.a]!.includes(segment.b))
      adjacency[segment.a]!.push(segment.b);
    if (!adjacency[segment.b]!.includes(segment.a))
      adjacency[segment.b]!.push(segment.a);
  }

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
    adjacency,
    wars: [],
    truces: [],
    warsWon: 0,
  };

  pushEvent(
    state,
    "info",
    `You have taken office as the leader of ${player.name}.`,
  );
  recordHistory(state, player);
  return state;
}
