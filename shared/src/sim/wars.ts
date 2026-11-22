import { createRng, mixSeed, type Rng } from "../world/random";
import {
  changeRelation,
  findTreaty,
  getRelation,
  type ActionResult,
} from "./diplomacy";
import { pushEvent } from "./events";
import { militaryPower } from "./military";
import { clamp } from "./policy";
import type { DecisionOption, SimState, War } from "./state";
import { TICKS_PER_DAY } from "./time";

export const TRUCE_MONTHS = 24;
export const WAR_GRACE_MONTHS = 18;
export const MAX_WARS_PER_NATION = 2;
export const MAX_ACTIVE_WARS = 3;
export const DEFENDER_BONUS = 1.25;
/** How far apart island capitals may be for naval operations */
export const ISLAND_RANGE = 650;
const AI_WAR_MAX_MONTHS = 36;

const money = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const monthTicks = (months: number): number => months * 30 * TICKS_PER_DAY;

type Side = "attackers" | "defenders";

// ---------- Queries ----------

export function sideOf(war: War, id: number): Side | null {
  if (war.attackers.includes(id)) return "attackers";
  if (war.defenders.includes(id)) return "defenders";
  return null;
}

export function warsOf(state: SimState, id: number): War[] {
  return state.wars.filter((w) => sideOf(w, id) !== null);
}

export function isAtWar(state: SimState, id: number): boolean {
  return state.wars.some((w) => sideOf(w, id) !== null);
}

export function findWarBetween(
  state: SimState,
  a: number,
  b: number,
): War | undefined {
  return state.wars.find((w) => {
    const sa = sideOf(w, a);
    const sb = sideOf(w, b);
    return sa !== null && sb !== null && sa !== sb;
  });
}

export function hasTruce(state: SimState, a: number, b: number): boolean {
  return state.truces.some(
    (t) =>
      ((t.a === a && t.b === b) || (t.a === b && t.b === a)) &&
      t.until > state.tick,
  );
}

export function neighborsOf(state: SimState, id: number): number[] {
  return state.adjacency[id] ?? [];
}

/** Land neighbours can fight, and so can islands within naval range. */
export function inRange(state: SimState, a: number, b: number): boolean {
  if (a === b) return false;
  if (neighborsOf(state, a).includes(b)) return true;
  const na = state.nations[a];
  const nb = state.nations[b];
  if (!na || !nb) return false;
  const island =
    neighborsOf(state, a).length === 0 || neighborsOf(state, b).length === 0;
  return island && Math.hypot(na.x - nb.x, na.y - nb.y) <= ISLAND_RANGE;
}

export function targetsInRange(state: SimState, id: number): number[] {
  return state.nations
    .filter((n) => n.id !== id && inRange(state, id, n.id))
    .map((n) => n.id);
}

function allianceMembers(state: SimState, id: number): number[] {
  return state.treaties
    .filter((t) => t.kind === "alliance" && (t.a === id || t.b === id))
    .map((t) => (t.a === id ? t.b : t.a));
}

/** Combined strength of one side. Allies commit only part of their force. */
export function sidePower(state: SimState, ids: number[]): number {
  let total = 0;
  ids.forEach((id, index) => {
    const n = state.nations[id];
    if (n) total += militaryPower(n) * (index === 0 ? 1 : 0.6);
  });
  return total;
}

export function warOutlook(
  state: SimState,
  attackerId: number,
  targetId: number,
): {
  attacker: number;
  defender: number;
  ratio: number;
  defenderAllies: number[];
} {
  const attacker = militaryPower(state.nations[attackerId]!);
  const defender = militaryPower(state.nations[targetId]!) * DEFENDER_BONUS;
  return {
    attacker,
    defender,
    ratio: attacker / Math.max(1, defender),
    defenderAllies: allianceMembers(state, targetId),
  };
}

// ---------- Decisions about war ----------

export type WarDecisionKind = "allyCall" | "warOnYou";

export const WAR_DECISION_OPTIONS: Record<WarDecisionKind, DecisionOption[]> = {
  allyCall: [
    {
      id: "join",
      label: "Join the war",
      detail:
        "Costs 1% of GDP. You fight beside your ally against their enemy.",
    },
    {
      id: "aid",
      label: "Send aid",
      detail: "Costs 0.5% of GDP. Improves relations with your ally.",
    },
    {
      id: "neutral",
      label: "Stay neutral",
      detail:
        "Relations with your ally fall sharply, and the alliance may collapse.",
    },
  ],
  warOnYou: [
    {
      id: "rally",
      label: "Rally the nation",
      detail:
        "Costs 0.5% of GDP. Approval and stability rise and reserves are called up.",
    },
    {
      id: "mobilise",
      label: "Full mobilisation",
      detail: "Costs 1.5% of GDP. The army grows by 12% right away.",
    },
    {
      id: "talks",
      label: "Seek immediate talks",
      detail:
        "Ask for a ceasefire. They may refuse if they think they are winning.",
    },
  ],
};

export function warDecisionText(
  kind: WarDecisionKind,
  state: SimState,
  target: number | null,
  other: number | null,
): string {
  const name = (id: number | null): string =>
    id === null
      ? "another nation"
      : (state.nations[id]?.name ?? "another nation");
  if (kind === "allyCall") {
    return `${name(target)}, your ally, is at war with ${name(other)} and is asking for your help.`;
  }
  return `${name(target)} has attacked your country. Your generals are waiting for orders.`;
}

/** Put a war decision in front of the player, unless another decision is already waiting. */
export function queueWarDecision(
  state: SimState,
  kind: WarDecisionKind,
  target: number | null,
  other: number | null,
): boolean {
  if (state.pendingDecision) return false;
  state.pendingDecision = {
    templateId: kind,
    title:
      kind === "allyCall"
        ? "Your ally calls for help"
        : "You are under attack!",
    text: warDecisionText(kind, state, target, other),
    target,
    other,
    options: WAR_DECISION_OPTIONS[kind].map((o) => ({ ...o })),
    tick: state.tick,
  };
  return true;
}

// ---------- Declaring and joining ----------

export function canDeclareWar(
  state: SimState,
  attackerId: number,
  targetId: number,
): ActionResult {
  const attacker = state.nations[attackerId];
  const target = state.nations[targetId];
  if (!attacker || !target || attackerId === targetId)
    return { ok: false, message: "Choose another nation." };
  if (findWarBetween(state, attackerId, targetId)) {
    return {
      ok: false,
      message: `${attacker.name} is already at war with ${target.name}.`,
    };
  }
  if (findTreaty(state, attackerId, targetId, "alliance")) {
    return {
      ok: false,
      message: `${target.name} is an ally. Withdraw from the alliance first.`,
    };
  }
  if (findTreaty(state, attackerId, targetId, "nonAggression")) {
    return {
      ok: false,
      message: `A non-aggression pact protects ${target.name}. Withdraw from it first.`,
    };
  }
  if (!inRange(state, attackerId, targetId)) {
    return {
      ok: false,
      message: `${target.name} is out of reach. War needs a land border, or an island within naval range.`,
    };
  }
  if (hasTruce(state, attackerId, targetId)) {
    return {
      ok: false,
      message: `A truce with ${target.name} is still in force.`,
    };
  }
  if (warsOf(state, attackerId).length >= MAX_WARS_PER_NATION) {
    return {
      ok: false,
      message: `${attacker.name} is already fighting ${MAX_WARS_PER_NATION} wars.`,
    };
  }
  return { ok: true, message: "" };
}

export function joinWar(
  state: SimState,
  war: War,
  id: number,
  side: Side,
): void {
  if (sideOf(war, id) !== null) return;
  war[side].push(id);
  const leaderId = side === "attackers" ? war.attackers[0]! : war.defenders[0]!;
  const enemyId = side === "attackers" ? war.defenders[0]! : war.attackers[0]!;
  changeRelation(state, id, enemyId, -20);

  const joiner = state.nations[id]!;
  const leader = state.nations[leaderId]!;
  const enemy = state.nations[enemyId]!;
  if (id === state.playerCountryId) {
    pushEvent(
      state,
      "warning",
      `You joined the war beside ${leader.name} against ${enemy.name}.`,
    );
  } else {
    pushEvent(
      state,
      "info",
      `${joiner.name} has joined the war beside ${leader.name} against ${enemy.name}.`,
    );
  }
}

function callAllies(state: SimState, war: War, rng: Rng): void {
  const attackerId = war.attackers[0]!;
  const defenderId = war.defenders[0]!;
  const sides: { leader: number; enemy: number; side: Side }[] = [
    { leader: defenderId, enemy: attackerId, side: "defenders" },
    { leader: attackerId, enemy: defenderId, side: "attackers" },
  ];

  for (const { leader, enemy, side } of sides) {
    for (const allyId of allianceMembers(state, leader)) {
      if (sideOf(war, allyId) !== null || allyId === enemy) continue;

      if (allyId === state.playerCountryId) {
        queueWarDecision(state, "allyCall", leader, enemy);
        continue;
      }
      if (warsOf(state, allyId).length >= MAX_WARS_PER_NATION) continue;
      if (
        findTreaty(state, allyId, enemy, "alliance") ||
        findTreaty(state, allyId, enemy, "nonAggression")
      )
        continue;

      const toEnemy = getRelation(state, allyId, enemy);
      const chance =
        (side === "defenders" ? 0.8 : 0.55) - (toEnemy > 40 ? 0.4 : 0);
      if (rng.next() < chance) joinWar(state, war, allyId, side);
    }
  }
}

export function declareWar(
  state: SimState,
  attackerId: number,
  targetId: number,
): War {
  const attacker = state.nations[attackerId]!;
  const target = state.nations[targetId]!;

  const war: War = {
    id: state.nextId,
    attackers: [attackerId],
    defenders: [targetId],
    start: state.tick,
    months: 0,
    score: 0,
    occupations: [],
  };
  state.nextId += 1;
  state.wars.push(war);

  // Trade deals between the belligerents end, and the world frowns on the aggressor
  state.treaties = state.treaties.filter(
    (t) =>
      !(
        (t.a === attackerId && t.b === targetId) ||
        (t.a === targetId && t.b === attackerId)
      ),
  );
  changeRelation(state, attackerId, targetId, -50);
  for (const other of state.nations) {
    if (other.id !== attackerId && other.id !== targetId)
      changeRelation(state, attackerId, other.id, -4);
  }
  target.approval = clamp(target.approval + 5, 0, 100);
  target.stability = clamp(target.stability + 2, 0, 100);
  attacker.approval = clamp(attacker.approval - 3, 0, 100);

  if (attackerId === state.playerCountryId) {
    pushEvent(state, "warning", `You declared war on ${target.name}.`);
  } else if (targetId === state.playerCountryId) {
    pushEvent(state, "crisis", `${attacker.name} has declared war on you!`);
    queueWarDecision(state, "warOnYou", attackerId, null);
  } else {
    pushEvent(
      state,
      "warning",
      `${attacker.name} has declared war on ${target.name}.`,
    );
  }

  callAllies(state, war, createRng(mixSeed(state.seed, state.tick, war.id)));
  return war;
}

// ---------- Ending wars ----------

export function endWar(
  state: SimState,
  war: War,
  winner: Side | null,
  reparationsShare: number,
): void {
  state.wars = state.wars.filter((w) => w.id !== war.id);

  const until = state.tick + monthTicks(TRUCE_MONTHS);
  for (const a of war.attackers) {
    for (const d of war.defenders) state.truces.push({ a, b: d, until });
  }
  state.truces = state.truces.filter((t) => t.until > state.tick);

  const attackerLeader = state.nations[war.attackers[0]!]!;
  const defenderLeader = state.nations[war.defenders[0]!]!;
  const player = state.playerCountryId;
  const playerInvolved = sideOf(war, player) !== null;

  if (winner === null) {
    changeRelation(state, attackerLeader.id, defenderLeader.id, 5);
    pushEvent(
      state,
      playerInvolved ? "good" : "info",
      `The war between ${attackerLeader.name} and ${defenderLeader.name} ended in a ceasefire.`,
    );
    return;
  }

  const winners = winner === "attackers" ? war.attackers : war.defenders;
  const victor = state.nations[winners[0]!]!;
  const loser = winner === "attackers" ? defenderLeader : attackerLeader;

  const reparations = loser.gdp * reparationsShare;
  victor.treasury += reparations;
  loser.treasury -= reparations;
  if (loser.treasury < 0) {
    loser.debt += -loser.treasury;
    loser.treasury = 0;
  }
  loser.stability = clamp(loser.stability - 10, 0, 100);
  loser.approval = clamp(loser.approval - 8, 0, 100);
  victor.approval = clamp(victor.approval + 8, 0, 100);
  victor.stability = clamp(victor.stability + 3, 0, 100);
  changeRelation(state, victor.id, loser.id, -10);

  const playerWon = winners.includes(player);
  if (playerWon) state.warsWon += 1;

  const text = `${loser.name} capitulated to ${victor.name}${reparations > 0 ? ` and pays $${money.format(reparations)} in reparations` : ""}.`;
  if (playerWon) pushEvent(state, "good", `Victory! ${text}`);
  else if (playerInvolved) pushEvent(state, "crisis", `Defeat. ${text}`);
  else pushEvent(state, "info", text);
}

function peaceVerdict(
  state: SimState,
  war: War,
  aiLeaderId: number,
): { ok: boolean; reason: string } {
  const ai = state.nations[aiLeaderId]!;
  const aiSide = sideOf(war, aiLeaderId);
  const aiScore = aiSide === "attackers" ? war.score : -war.score;

  if (aiScore < -10)
    return {
      ok: true,
      reason: `${ai.name} is losing and accepts a ceasefire.`,
    };
  if (aiScore < 15 && (ai.warWeariness >= 45 || war.months >= 18)) {
    return {
      ok: true,
      reason: `${ai.name} is exhausted and accepts a ceasefire.`,
    };
  }
  return {
    ok: false,
    reason:
      aiScore >= 15
        ? `${ai.name} believes it is winning and refuses a ceasefire.`
        : `${ai.name} is not yet weary enough to talk peace.`,
  };
}

export function playerProposePeace(
  state: SimState,
  warId: number,
): ActionResult {
  const war = state.wars.find((w) => w.id === warId);
  const side = war ? sideOf(war, state.playerCountryId) : null;
  if (!war || side === null)
    return { ok: false, message: "You are not part of that war." };

  const foeLeader =
    side === "attackers" ? war.defenders[0]! : war.attackers[0]!;
  const verdict = peaceVerdict(state, war, foeLeader);
  if (!verdict.ok) {
    pushEvent(state, "warning", verdict.reason);
    return { ok: false, message: verdict.reason };
  }
  endWar(state, war, null, 0);
  return { ok: true, message: verdict.reason };
}

export function playerDemandSurrender(
  state: SimState,
  warId: number,
): ActionResult {
  const war = state.wars.find((w) => w.id === warId);
  const side = war ? sideOf(war, state.playerCountryId) : null;
  if (!war || side === null)
    return { ok: false, message: "You are not part of that war." };

  const myScore = side === "attackers" ? war.score : -war.score;
  if (myScore < 50) {
    const message = `You need a decisive advantage (war score 50+) to demand surrender. It is ${Math.round(myScore)}.`;
    pushEvent(state, "warning", message);
    return { ok: false, message };
  }
  endWar(state, war, side, 0.08);
  return { ok: true, message: "The enemy surrendered." };
}

export function playerDeclareWar(
  state: SimState,
  targetId: number,
): ActionResult {
  const check = canDeclareWar(state, state.playerCountryId, targetId);
  if (!check.ok) {
    pushEvent(state, "warning", check.message);
    return check;
  }
  declareWar(state, state.playerCountryId, targetId);
  return {
    ok: true,
    message: `You declared war on ${state.nations[targetId]!.name}.`,
  };
}

// ---------- Monthly simulation ----------

/** War costs and war damage reduce growth. Runs before the economy step. */
export function refreshWarEffects(state: SimState): void {
  for (const n of state.nations) {
    n.warCostRate = 0;
    n.warPenalty = 0;
  }
  for (const war of state.wars) {
    for (const ids of [war.attackers, war.defenders]) {
      ids.forEach((id, index) => {
        const n = state.nations[id];
        if (!n) return;
        n.warCostRate += index === 0 ? 0.03 : 0.015;
        n.warPenalty += index === 0 ? 0.02 : 0.01;
      });
    }
    for (const occupation of war.occupations) {
      const victim = state.nations[occupation.victim];
      if (victim) victim.warPenalty += 0.04 * occupation.fraction;
    }
  }
  for (const n of state.nations) {
    n.warCostRate = Math.min(n.warCostRate, 0.07);
    n.warPenalty = Math.min(n.warPenalty, 0.06);
  }
}

/** The holder gains ground. Territory the victim had taken from the holder is retaken first. */
function pushOccupation(
  state: SimState,
  war: War,
  holder: number,
  victim: number,
  amount: number,
): void {
  let remaining = amount;
  const reverse = war.occupations.find(
    (o) => o.holder === victim && o.victim === holder,
  );
  if (reverse && reverse.fraction > 0) {
    const cut = Math.min(reverse.fraction, remaining);
    reverse.fraction -= cut;
    remaining -= cut;
  }
  if (remaining > 0) {
    let occupation = war.occupations.find(
      (o) => o.holder === holder && o.victim === victim,
    );
    if (!occupation) {
      occupation = { holder, victim, fraction: 0 };
      war.occupations.push(occupation);
    }
    const gain = Math.min(remaining, 1 - occupation.fraction);
    occupation.fraction += gain;
    const v = state.nations[victim];
    if (v) {
      v.gdp *= 1 - 0.15 * gain;
      v.population *= 1 - 0.04 * gain;
    }
  }
  war.occupations = war.occupations.filter((o) => o.fraction > 0.001);
}

function involvesPlayer(state: SimState, war: War): boolean {
  return sideOf(war, state.playerCountryId) !== null;
}

function advanceWar(state: SimState, war: War): void {
  const rng = createRng(mixSeed(state.seed, state.tick, war.id * 31 + 17));
  const attackPower = sidePower(state, war.attackers);
  const defencePower = sidePower(state, war.defenders) * DEFENDER_BONUS;

  const advantage =
    Math.log(Math.max(1, attackPower) / Math.max(1, defencePower)) +
    rng.range(-0.15, 0.15);
  const shift = clamp(advantage * 7, -12, 12);
  war.score = clamp(war.score + shift, -100, 100);
  war.months += 1;

  const attackerLeader = war.attackers[0]!;
  const defenderLeader = war.defenders[0]!;
  if (shift > 0)
    pushOccupation(state, war, attackerLeader, defenderLeader, shift * 0.012);
  else if (shift < 0)
    pushOccupation(state, war, defenderLeader, attackerLeader, -shift * 0.01);

  // The fighting keeps the leaders hostile
  changeRelation(state, attackerLeader, defenderLeader, -3);

  // Casualties and weariness
  const sides = [
    { ids: war.attackers, mine: attackPower, theirs: defencePower },
    { ids: war.defenders, mine: defencePower, theirs: attackPower },
  ];
  for (const side of sides) {
    const share = side.theirs / Math.max(1, side.theirs + side.mine);
    const loss = 0.008 + 0.012 * share;
    side.ids.forEach((id, index) => {
      const n = state.nations[id];
      if (!n) return;
      const lost = n.army * loss * (index === 0 ? 1 : 0.6);
      n.army = Math.max(1000, n.army - lost);
      n.population = Math.max(1000, n.population - lost * 0.2);
      n.warWeariness = clamp(n.warWeariness + (index === 0 ? 3 : 2), 0, 100);
    });
  }

  // How wars end
  if (war.score >= 100) {
    endWar(state, war, "attackers", 0.12);
  } else if (war.score <= -100) {
    endWar(state, war, "defenders", 0.12);
  } else if (!involvesPlayer(state, war)) {
    const weariest = Math.max(
      state.nations[attackerLeader]!.warWeariness,
      state.nations[defenderLeader]!.warWeariness,
    );
    if (war.months >= AI_WAR_MAX_MONTHS || weariest >= 70)
      endWar(state, war, null, 0);
  }
}

function runAiWarDeclarations(state: SimState): void {
  if (state.tick < monthTicks(WAR_GRACE_MONTHS)) return;
  const rng = createRng(mixSeed(state.seed, state.tick, 8844));

  for (const ai of state.nations) {
    if (state.wars.length >= MAX_ACTIVE_WARS) break;
    if (ai.id === state.playerCountryId || isAtWar(state, ai.id)) continue;
    if (rng.next() > 0.01 + 0.03 * ai.personality.militarism) continue;

    let bestTarget = -1;
    let bestScore = -Infinity;
    for (const targetId of targetsInRange(state, ai.id)) {
      if (!canDeclareWar(state, ai.id, targetId).ok) continue;
      const relation = getRelation(state, ai.id, targetId);
      if (relation > 10) continue;
      const target = state.nations[targetId]!;
      const edge = Math.log(
        militaryPower(ai) / Math.max(1, militaryPower(target) * DEFENDER_BONUS),
      );
      if (edge < 0.1 - 0.2 * ai.personality.militarism) continue;
      const score =
        edge - relation / 150 - 0.2 * allianceMembers(state, targetId).length;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetId;
      }
    }
    if (bestTarget >= 0) declareWar(state, ai.id, bestTarget);
  }
}

function checkConquest(state: SimState): void {
  if (state.gameOver) return;
  for (const war of state.wars) {
    for (const occupation of war.occupations) {
      if (
        occupation.victim === state.playerCountryId &&
        occupation.fraction >= 0.85
      ) {
        pushEvent(
          state,
          "crisis",
          "Your country has been overrun by enemy forces.",
        );
        state.gameOver = { reason: "conquest", tick: state.tick };
        return;
      }
    }
  }
}

/** Fighting, AI aggression and conquest, once a month. */
export function runWarsMonthly(state: SimState): void {
  for (const war of [...state.wars]) advanceWar(state, war);
  runAiWarDeclarations(state);
  checkConquest(state);
}
