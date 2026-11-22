import { createRng, mixSeed } from "../world/random";
import { markCooldown, onCooldown, pushEvent } from "./events";
import { clamp } from "./policy";
import type { NationState, SimState, TreatyKind } from "./state";
import { TICKS_PER_DAY } from "./time";

export const MAX_TRADE_TREATIES = 5;
export const MAX_ALLIANCES = 2;
/** Cost of a diplomatic mission, as a share of the player's GDP */
export const IMPROVE_COST_GDP = 0.003;

const MAX_PROPOSALS = 3;
const PROPOSAL_LIFETIME_TICKS = 180 * TICKS_PER_DAY;

export interface ActionResult {
  ok: boolean;
  message: string;
}

export const TREATY_LABELS: Record<TreatyKind, string> = {
  trade: "trade agreement",
  nonAggression: "non-aggression pact",
  alliance: "alliance",
};

const DEMOCRATIC = new Set([
  "Parliamentary republic",
  "Presidential republic",
  "Federal republic",
  "Constitutional monarchy",
]);

/** The long-run friendliness between two nations before treaties and sanctions. */
export function baseRelation(
  seed: number,
  a: NationState,
  b: NationState,
): number {
  const lo = Math.min(a.id, b.id);
  const hi = Math.max(a.id, b.id);
  let base = (createRng(mixSeed(seed, 31, lo * 64 + hi)).next() - 0.5) * 40;
  if (a.region === b.region) base += 12;
  const aDemo = DEMOCRATIC.has(a.governmentType);
  const bDemo = DEMOCRATIC.has(b.governmentType);
  if (aDemo && bDemo) base += 10;
  else if (!aDemo && !bDemo) base += 6;
  else base -= 8;
  return clamp(base, -60, 60);
}

export function createInitialRelations(
  seed: number,
  nations: NationState[],
): number[][] {
  const n = nations.length;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) matrix.push(new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = Math.round(baseRelation(seed, nations[i]!, nations[j]!));
      matrix[i]![j] = value;
      matrix[j]![i] = value;
    }
  }
  return matrix;
}

export function getRelation(state: SimState, a: number, b: number): number {
  return state.relations[a]?.[b] ?? 0;
}

export function changeRelation(
  state: SimState,
  a: number,
  b: number,
  delta: number,
): void {
  if (a === b) return;
  const rowA = state.relations[a];
  const rowB = state.relations[b];
  if (!rowA || !rowB) return;
  const next = clamp(getRelation(state, a, b) + delta, -100, 100);
  rowA[b] = next;
  rowB[a] = next;
}

export function findTreaty(
  state: SimState,
  a: number,
  b: number,
  kind: TreatyKind,
) {
  return state.treaties.find(
    (t) =>
      t.kind === kind && ((t.a === a && t.b === b) || (t.a === b && t.b === a)),
  );
}

export function countTreaties(
  state: SimState,
  id: number,
  kind: TreatyKind,
): number {
  return state.treaties.filter(
    (t) => t.kind === kind && (t.a === id || t.b === id),
  ).length;
}

export function isSanctioned(
  state: SimState,
  by: number,
  target: number,
): boolean {
  return state.sanctions.some((s) => s.by === by && s.target === target);
}

export function treatyCapacityLeft(
  state: SimState,
  id: number,
  kind: TreatyKind,
): boolean {
  if (kind === "trade")
    return countTreaties(state, id, "trade") < MAX_TRADE_TREATIES;
  if (kind === "alliance")
    return countTreaties(state, id, "alliance") < MAX_ALLIANCES;
  return true;
}

/** The relation score an AI nation needs to feel before it accepts. */
export function proposalThreshold(ai: NationState, kind: TreatyKind): number {
  if (kind === "trade") return 0;
  if (kind === "nonAggression")
    return Math.round(10 + 25 * ai.personality.militarism);
  return 50;
}

export function evaluateProposal(
  state: SimState,
  aiId: number,
  fromId: number,
  kind: TreatyKind,
): ActionResult {
  const ai = state.nations[aiId]!;
  const relation = getRelation(state, aiId, fromId);

  if (isSanctioned(state, aiId, fromId) || isSanctioned(state, fromId, aiId)) {
    return {
      ok: false,
      message: `${ai.name} refuses to talk while sanctions are in place.`,
    };
  }
  if (!treatyCapacityLeft(state, aiId, kind)) {
    return {
      ok: false,
      message: `${ai.name} has no room left for another ${TREATY_LABELS[kind]}.`,
    };
  }
  const need = proposalThreshold(ai, kind);
  if (relation < need) {
    return {
      ok: false,
      message: `${ai.name} declined the ${TREATY_LABELS[kind]}: relations are too cold (they want at least ${need}, currently ${Math.round(relation)}).`,
    };
  }
  return {
    ok: true,
    message: `${ai.name} agreed to a ${TREATY_LABELS[kind]}.`,
  };
}

export function signTreaty(
  state: SimState,
  a: number,
  b: number,
  kind: TreatyKind,
): void {
  state.treaties.push({ id: state.nextId, kind, a, b, since: state.tick });
  state.nextId += 1;
  changeRelation(state, a, b, kind === "alliance" ? 15 : 8);
}

function removeTreatiesBetween(state: SimState, a: number, b: number): void {
  state.treaties = state.treaties.filter(
    (t) => !((t.a === a && t.b === b) || (t.a === b && t.b === a)),
  );
}

function report(state: SimState, result: ActionResult): ActionResult {
  pushEvent(state, result.ok ? "good" : "warning", result.message);
  return result;
}

// ---------- Player actions ----------

export function playerImproveRelations(
  state: SimState,
  target: number,
): ActionResult {
  const player = state.nations[state.playerCountryId]!;
  const other = state.nations[target];
  if (!other || target === player.id)
    return { ok: false, message: "Choose another nation." };

  const key = `improve:${player.id}:${target}`;
  if (onCooldown(state, key, 3)) {
    return report(state, {
      ok: false,
      message: `You recently courted ${other.name}. Give it a few months.`,
    });
  }
  const cost = player.gdp * IMPROVE_COST_GDP;
  if (player.treasury < cost) {
    return report(state, {
      ok: false,
      message: "There is not enough in the treasury for a diplomatic mission.",
    });
  }
  player.treasury -= cost;
  markCooldown(state, key);
  changeRelation(state, player.id, target, 10);
  return report(state, {
    ok: true,
    message: `Your diplomatic mission to ${other.name} improved relations.`,
  });
}

export function playerProposeTreaty(
  state: SimState,
  target: number,
  kind: TreatyKind,
): ActionResult {
  const player = state.nations[state.playerCountryId]!;
  const other = state.nations[target];
  if (!other || target === player.id)
    return { ok: false, message: "Choose another nation." };

  if (findTreaty(state, player.id, target, kind)) {
    return report(state, {
      ok: false,
      message: `You already have a ${TREATY_LABELS[kind]} with ${other.name}.`,
    });
  }
  if (!treatyCapacityLeft(state, player.id, kind)) {
    return report(state, {
      ok: false,
      message: `You have no room left for another ${TREATY_LABELS[kind]}.`,
    });
  }
  const verdict = evaluateProposal(state, target, player.id, kind);
  if (!verdict.ok) {
    changeRelation(state, player.id, target, -2);
    return report(state, verdict);
  }
  signTreaty(state, player.id, target, kind);
  return report(state, verdict);
}

export function playerCancelTreaty(
  state: SimState,
  treatyId: number,
): ActionResult {
  const player = state.nations[state.playerCountryId]!;
  const index = state.treaties.findIndex((t) => t.id === treatyId);
  const treaty = state.treaties[index];
  if (!treaty || (treaty.a !== player.id && treaty.b !== player.id)) {
    return { ok: false, message: "That treaty does not exist." };
  }
  const partnerId = treaty.a === player.id ? treaty.b : treaty.a;
  const partner = state.nations[partnerId]!;
  state.treaties.splice(index, 1);
  changeRelation(
    state,
    player.id,
    partnerId,
    treaty.kind === "alliance" ? -30 : -20,
  );
  const message = `You withdrew from the ${TREATY_LABELS[treaty.kind]} with ${partner.name}.`;
  pushEvent(state, "warning", message);
  return { ok: true, message };
}

export function playerSetSanctions(
  state: SimState,
  target: number,
  active: boolean,
): ActionResult {
  const player = state.nations[state.playerCountryId]!;
  const other = state.nations[target];
  if (!other || target === player.id)
    return { ok: false, message: "Choose another nation." };

  const index = state.sanctions.findIndex(
    (s) => s.by === player.id && s.target === target,
  );
  if (active) {
    if (index >= 0)
      return { ok: false, message: `You already sanction ${other.name}.` };
    state.sanctions.push({ by: player.id, target, since: state.tick });
    removeTreatiesBetween(state, player.id, target);
    changeRelation(state, player.id, target, -40);
    const message = `You imposed sanctions on ${other.name}. Their economy will suffer, and yours slightly.`;
    pushEvent(state, "warning", message);
    return { ok: true, message };
  }
  if (index < 0)
    return { ok: false, message: `You are not sanctioning ${other.name}.` };
  state.sanctions.splice(index, 1);
  changeRelation(state, player.id, target, 10);
  const message = `You lifted sanctions on ${other.name}.`;
  pushEvent(state, "info", message);
  return { ok: true, message };
}

export function playerRespondProposal(
  state: SimState,
  proposalId: number,
  accept: boolean,
): ActionResult {
  const player = state.nations[state.playerCountryId]!;
  const index = state.proposals.findIndex((p) => p.id === proposalId);
  const proposal = state.proposals[index];
  if (!proposal) return { ok: false, message: "That proposal has expired." };
  const from = state.nations[proposal.from]!;

  if (!accept) {
    state.proposals.splice(index, 1);
    changeRelation(state, player.id, from.id, -1);
    const message = `You declined the ${TREATY_LABELS[proposal.kind]} offered by ${from.name}.`;
    pushEvent(state, "info", message);
    return { ok: true, message };
  }
  if (findTreaty(state, player.id, from.id, proposal.kind)) {
    state.proposals.splice(index, 1);
    return report(state, {
      ok: false,
      message: `You already have that agreement with ${from.name}.`,
    });
  }
  if (
    !treatyCapacityLeft(state, player.id, proposal.kind) ||
    !treatyCapacityLeft(state, from.id, proposal.kind)
  ) {
    return report(state, {
      ok: false,
      message: `No room left for another ${TREATY_LABELS[proposal.kind]}.`,
    });
  }
  signTreaty(state, player.id, from.id, proposal.kind);
  state.proposals.splice(index, 1);
  return report(state, {
    ok: true,
    message: `You signed a ${TREATY_LABELS[proposal.kind]} with ${from.name}.`,
  });
}

// ---------- Monthly simulation ----------

/** Recompute each nation's growth from trade deals and sanctions. Runs before the economy step. */
export function refreshDiplomacyEffects(state: SimState): void {
  for (const n of state.nations) {
    n.tradeBonus = 0;
    n.sanctionPenalty = 0;
  }
  for (const t of state.treaties) {
    if (t.kind === "nonAggression") continue;
    const factor = t.kind === "trade" ? 1 : 0.5;
    const a = state.nations[t.a];
    const b = state.nations[t.b];
    if (!a || !b) continue;
    a.tradeBonus += factor * 0.002 * clamp(Math.sqrt(b.gdp / a.gdp), 0.3, 1.5);
    b.tradeBonus += factor * 0.002 * clamp(Math.sqrt(a.gdp / b.gdp), 0.3, 1.5);
  }
  for (const s of state.sanctions) {
    const target = state.nations[s.target];
    const by = state.nations[s.by];
    if (target) target.sanctionPenalty += 0.008;
    if (by) by.sanctionPenalty += 0.001;
  }
  for (const n of state.nations) {
    n.tradeBonus = Math.min(n.tradeBonus, 0.015);
    n.sanctionPenalty = Math.min(n.sanctionPenalty, 0.025);
  }
}

function pickProposalKind(
  state: SimState,
  aiId: number,
  playerId: number,
  relation: number,
): TreatyKind | null {
  const room = (kind: TreatyKind): boolean =>
    treatyCapacityLeft(state, aiId, kind) &&
    treatyCapacityLeft(state, playerId, kind);
  if (
    relation >= 55 &&
    !findTreaty(state, aiId, playerId, "alliance") &&
    room("alliance")
  )
    return "alliance";
  if (
    relation >= 25 &&
    !findTreaty(state, aiId, playerId, "trade") &&
    room("trade")
  )
    return "trade";
  if (relation >= 20 && !findTreaty(state, aiId, playerId, "nonAggression"))
    return "nonAggression";
  return null;
}

/** Relations drift, AI nations make deals, offers arrive and sanctions change. */
export function runDiplomacy(state: SimState): void {
  const rng = createRng(mixSeed(state.seed, state.tick, 5150));
  const player = state.playerCountryId;
  const count = state.nations.length;

  state.proposals = state.proposals.filter((p) => p.expires > state.tick);

  // 1. Relations drift towards their long-run level, shifted by treaties and sanctions
  const bonus = new Map<number, number>();
  const bump = (a: number, b: number, value: number): void => {
    const key = Math.min(a, b) * 64 + Math.max(a, b);
    bonus.set(key, (bonus.get(key) ?? 0) + value);
  };
  for (const t of state.treaties)
    bump(t.a, t.b, t.kind === "alliance" ? 30 : t.kind === "trade" ? 12 : 8);
  for (const s of state.sanctions) bump(s.by, s.target, -40);
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const target =
        baseRelation(state.seed, state.nations[i]!, state.nations[j]!) +
        (bonus.get(i * 64 + j) ?? 0);
      const current = getRelation(state, i, j);
      changeRelation(state, i, j, (target - current) * 0.04);
    }
  }

  // 2. AI nations make deals with each other
  for (const ai of state.nations) {
    if (ai.id === player || rng.next() > 0.12) continue;
    const others = state.nations.filter(
      (o) => o.id !== ai.id && o.id !== player,
    );
    const other = others[rng.int(others.length)]!;
    const relation = getRelation(state, ai.id, other.id);
    const room = (kind: TreatyKind): boolean =>
      treatyCapacityLeft(state, ai.id, kind) &&
      treatyCapacityLeft(state, other.id, kind);

    if (
      relation >= 50 &&
      !findTreaty(state, ai.id, other.id, "alliance") &&
      room("alliance") &&
      rng.next() < 0.3
    ) {
      signTreaty(state, ai.id, other.id, "alliance");
      pushEvent(
        state,
        "info",
        `${ai.name} and ${other.name} have formed an alliance.`,
      );
    } else if (
      relation >= 20 &&
      !findTreaty(state, ai.id, other.id, "trade") &&
      room("trade")
    ) {
      signTreaty(state, ai.id, other.id, "trade");
    } else if (
      relation >= 15 &&
      !findTreaty(state, ai.id, other.id, "nonAggression")
    ) {
      signTreaty(state, ai.id, other.id, "nonAggression");
    }
  }

  // 3. AI nations send the player offers
  for (const ai of state.nations) {
    if (state.proposals.length >= MAX_PROPOSALS) break;
    if (ai.id === player || rng.next() > 0.06) continue;
    if (
      isSanctioned(state, player, ai.id) ||
      isSanctioned(state, ai.id, player)
    )
      continue;
    const kind = pickProposalKind(
      state,
      ai.id,
      player,
      getRelation(state, ai.id, player),
    );
    if (!kind) continue;
    if (state.proposals.some((p) => p.from === ai.id && p.kind === kind))
      continue;
    state.proposals.push({
      id: state.nextId,
      from: ai.id,
      kind,
      tick: state.tick,
      expires: state.tick + PROPOSAL_LIFETIME_TICKS,
    });
    state.nextId += 1;
    pushEvent(
      state,
      "info",
      `${ai.name} proposes a ${TREATY_LABELS[kind]}. Check the Diplomacy tab.`,
    );
  }

  // 4. Hostile militaristic nations may sanction the player, and relent when relations recover
  for (const ai of state.nations) {
    if (ai.id === player) continue;
    const relation = getRelation(state, ai.id, player);
    const sanctioning = isSanctioned(state, ai.id, player);
    if (
      !sanctioning &&
      relation < -45 &&
      ai.personality.militarism > 0.45 &&
      rng.next() < 0.15
    ) {
      state.sanctions.push({ by: ai.id, target: player, since: state.tick });
      removeTreatiesBetween(state, ai.id, player);
      pushEvent(state, "crisis", `${ai.name} has imposed sanctions on you.`);
    } else if (sanctioning && relation >= -10) {
      state.sanctions = state.sanctions.filter(
        (s) => !(s.by === ai.id && s.target === player),
      );
      pushEvent(state, "good", `${ai.name} has lifted its sanctions on you.`);
    }
  }
}
