import { createRng, mixSeed } from "../world/random";
import { runAiPolicy } from "./ai";
import { maybeTriggerDecision } from "./decisions";
import { refreshDiplomacyEffects, runDiplomacy } from "./diplomacy";
import { stepEconomy } from "./economy";
import { pushEvent, raiseAlert } from "./events";
import { recordHistory } from "./history";
import type { SimState } from "./state";
import { SIM_CONFIG, isElectionYear, tickToDate } from "./time";

const money = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const pct = (ratio: number, digits = 1): string =>
  `${(ratio * 100).toFixed(digits)}%`;

const NO_ELECTIONS = new Set([
  "Absolute monarchy",
  "One-party state",
  "Military government",
]);

export function hasElections(governmentType: string): boolean {
  return !NO_ELECTIONS.has(governmentType);
}

/** Resolve an election. Returns true if the player stays in power. */
export function holdElection(state: SimState): boolean {
  const player = state.nations[state.playerCountryId]!;
  const rng = createRng(mixSeed(state.seed, state.tick, 4242));
  const won = player.approval + rng.range(-6, 6) >= 50;
  const approval = Math.round(player.approval);

  if (won) {
    state.electionsWon += 1;
    pushEvent(
      state,
      "good",
      `Election day: you were re-elected with ${approval}% approval.`,
    );
  } else {
    pushEvent(
      state,
      "crisis",
      `Election day: voters turned you out of office (${approval}% approval).`,
    );
    state.gameOver = { reason: "election", tick: state.tick };
  }
  return won;
}

function checkPlayerAlerts(state: SimState): void {
  const n = state.nations[state.playerCountryId]!;
  const debtRatio = n.debt / n.gdp;

  if (n.growth < 0) {
    raiseAlert(
      state,
      "recession",
      12,
      "warning",
      `The economy is shrinking (growth ${pct(n.growth)}).`,
    );
  }
  if (n.inflation > 0.08) {
    raiseAlert(
      state,
      "inflation",
      12,
      "warning",
      `Inflation has surged to ${pct(n.inflation)}.`,
    );
  }
  if (n.unemployment > 0.14) {
    raiseAlert(
      state,
      "unemployment",
      12,
      "warning",
      `Unemployment has climbed to ${pct(n.unemployment)}.`,
    );
  }
  if (debtRatio > 1.2) {
    raiseAlert(
      state,
      "debt",
      12,
      "warning",
      `National debt has reached ${pct(debtRatio, 0)} of GDP.`,
    );
  }
  if (n.approval < 30) {
    raiseAlert(
      state,
      "approval-low",
      12,
      "crisis",
      `Approval has collapsed to ${Math.round(n.approval)}%.`,
    );
  }
  if (n.approval > 70) {
    raiseAlert(
      state,
      "approval-high",
      24,
      "good",
      `Approval has soared to ${Math.round(n.approval)}%.`,
    );
  }
  if (n.stability < 30) {
    raiseAlert(
      state,
      "stability",
      12,
      "crisis",
      `Unrest is spreading (stability ${Math.round(n.stability)}%).`,
    );
  }
  if (n.treasury <= 0) {
    raiseAlert(
      state,
      "treasury",
      12,
      "info",
      "The treasury is empty and the state is borrowing to pay its bills.",
    );
  }
}

/** Everything that happens on the first day of each month. */
export function runMonthly(state: SimState): void {
  const date = tickToDate(state.tick);

  // 1. Trade deals and sanctions feed into growth
  refreshDiplomacyEffects(state);

  // 2. Every nation's economy
  for (const nation of state.nations) {
    stepEconomy(nation, createRng(mixSeed(state.seed, state.tick, nation.id)));
  }

  // 3. Relations, treaties, offers and sanctions
  runDiplomacy(state);

  // 4. AI governments adjust policy (the player is never touched)
  for (const nation of state.nations) {
    if (nation.id === state.playerCountryId) continue;
    runAiPolicy(
      nation,
      createRng(mixSeed(state.seed, state.tick, nation.id + 1000)),
    );
  }

  const player = state.nations[state.playerCountryId]!;
  recordHistory(state, player);
  checkPlayerAlerts(state);

  // 5. Collapse check
  if (player.stability < 10) player.lowStabilityMonths += 1;
  else player.lowStabilityMonths = 0;
  if (player.lowStabilityMonths >= 3 && !state.gameOver) {
    pushEvent(
      state,
      "crisis",
      "Your government has collapsed amid widespread unrest.",
    );
    state.gameOver = { reason: "collapse", tick: state.tick };
    return;
  }

  // 6. January: the end of the campaign, the annual report and elections
  if (date.getUTCMonth() === 0) {
    const year = date.getUTCFullYear();
    if (year >= SIM_CONFIG.campaignEndYear) {
      pushEvent(
        state,
        "good",
        `Your time in office ends after ${year - SIM_CONFIG.startYear} years.`,
      );
      state.gameOver = { reason: "retirement", tick: state.tick };
      return;
    }
    pushEvent(
      state,
      "info",
      `Annual report ${year - 1}: GDP $${money.format(player.gdp)} (growth ${pct(player.growth)}), ` +
        `inflation ${pct(player.inflation)}, unemployment ${pct(player.unemployment)}, ` +
        `approval ${Math.round(player.approval)}%.`,
    );
    if (isElectionYear(year) && hasElections(player.governmentType))
      holdElection(state);
  }

  // 7. Perhaps a crisis lands on the player's desk
  maybeTriggerDecision(state);
}
