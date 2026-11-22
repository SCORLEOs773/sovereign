import { createRng, mixSeed, type Rng } from "../world/random";
import { changeRelation } from "./diplomacy";
import { markCooldown, onCooldown, pushEvent } from "./events";
import { clamp } from "./policy";
import type { NationState, SimState } from "./state";

interface Ctx {
  n: NationState;
  state: SimState;
  target: number | null;
  rng: Rng;
}

interface OptionDef {
  id: string;
  label: string;
  detail: string;
  /** Applies the effects and returns a sentence describing what happened */
  apply: (ctx: Ctx) => string;
}

export interface DecisionTemplate {
  id: string;
  title: string;
  cooldownMonths: number;
  needsTarget?: boolean;
  /** How likely this crisis is right now (0 means it cannot happen) */
  weight: (n: NationState, state: SimState) => number;
  describe: (n: NationState, state: SimState, target: number | null) => string;
  options: OptionDef[];
}

const AUTHORITARIAN = new Set([
  "Absolute monarchy",
  "One-party state",
  "Military government",
]);
const pct = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`;

interface Shock {
  approval?: number;
  stability?: number;
  growth?: number;
  inflation?: number;
  unemployment?: number;
  growthBonus?: number;
  /** Multiplier */
  population?: number;
}

function shock(n: NationState, s: Shock): void {
  if (s.approval) n.approval = clamp(n.approval + s.approval, 0, 100);
  if (s.stability) n.stability = clamp(n.stability + s.stability, 0, 100);
  if (s.growth) n.growth = clamp(n.growth + s.growth, -0.2, 0.15);
  if (s.inflation) n.inflation = clamp(n.inflation + s.inflation, -0.05, 0.8);
  if (s.unemployment)
    n.unemployment = clamp(n.unemployment + s.unemployment, 0.01, 0.5);
  if (s.growthBonus)
    n.growthBonus = clamp(n.growthBonus + s.growthBonus, -0.03, 0.03);
  if (s.population) n.population *= s.population;
}

/** Spend a share of GDP. A negative amount adds money. Overdrafts become debt. */
function spend(n: NationState, fractionOfGdp: number): void {
  const cost = n.gdp * fractionOfGdp;
  if (cost < 0) {
    n.treasury += -cost;
  } else if (n.treasury >= cost) {
    n.treasury -= cost;
  } else {
    n.debt += cost - n.treasury;
    n.treasury = 0;
  }
}

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    id: "strike",
    title: "General strike threatened",
    cooldownMonths: 18,
    weight: (n) =>
      n.inflation > 0.035 ? 1.2 + (n.inflation - 0.035) * 20 : 0.3,
    describe: (n) =>
      `Unions are threatening a general strike over the cost of living. Inflation is running at ${pct(n.inflation)}.`,
    options: [
      {
        id: "wages",
        label: "Grant wage rises",
        detail:
          "Costs 1% of GDP. Approval and stability up, but inflation rises.",
        apply: ({ n }) => {
          spend(n, 0.01);
          shock(n, { approval: 4, stability: 3, inflation: 0.008 });
          return "You granted wage rises and the strike was averted.";
        },
      },
      {
        id: "firm",
        label: "Hold firm",
        detail: "Approval and stability fall, and growth slows.",
        apply: ({ n }) => {
          shock(n, { approval: -5, stability: -5, growth: -0.01 });
          return "You refused to budge. The strikes hurt output and public mood.";
        },
      },
      {
        id: "mediate",
        label: "Broker a compromise",
        detail: "Costs 0.2% of GDP. A small gain for everyone.",
        apply: ({ n }) => {
          spend(n, 0.002);
          shock(n, { approval: 1, stability: 1 });
          return "A compromise deal ended the dispute.";
        },
      },
    ],
  },
  {
    id: "oil",
    title: "Oil price shock",
    cooldownMonths: 24,
    weight: () => 0.5,
    describe: () =>
      "A global oil price spike is squeezing households and industry.",
    options: [
      {
        id: "subsidy",
        label: "Subsidise fuel",
        detail: "Costs 1.5% of GDP. Approval up, inflation a little higher.",
        apply: ({ n }) => {
          spend(n, 0.015);
          shock(n, { approval: 3, inflation: 0.005 });
          return "Fuel subsidies cushioned the blow for households.";
        },
      },
      {
        id: "market",
        label: "Let prices rise",
        detail: "Approval falls, growth slows and inflation climbs.",
        apply: ({ n }) => {
          shock(n, { approval: -4, growth: -0.01, inflation: 0.01 });
          return "Prices rose sharply and the public blamed you.";
        },
      },
    ],
  },
  {
    id: "techBoom",
    title: "Start-up boom",
    cooldownMonths: 30,
    weight: (n) =>
      n.policy.spending.education >= n.baseline.spending.education ? 0.6 : 0.2,
    describe: () =>
      "A wave of ambitious start-ups is asking the government to back the sector.",
    options: [
      {
        id: "incentives",
        label: "Offer start-up incentives",
        detail: "Costs 1% of GDP. A lasting boost to growth.",
        apply: ({ n }) => {
          spend(n, 0.01);
          shock(n, { growthBonus: 0.003, approval: 1 });
          return "Incentives lured founders and investors to your country.";
        },
      },
      {
        id: "hub",
        label: "Build a national research hub",
        detail: "Costs 1.5% of GDP. Better growth and fewer unemployed.",
        apply: ({ n }) => {
          spend(n, 0.015);
          shock(n, { growthBonus: 0.004, unemployment: -0.005 });
          return "The research hub became a magnet for talent.";
        },
      },
      {
        id: "hands",
        label: "Stay out of it",
        detail: "No cost, no change.",
        apply: () => "You left the market to itself.",
      },
    ],
  },
  {
    id: "banking",
    title: "Banking scare",
    cooldownMonths: 30,
    weight: (n) => (n.debt / n.gdp > 0.9 ? 0.9 : 0.15),
    describe: () =>
      "A major bank is on the brink of collapse and depositors are queuing outside branches.",
    options: [
      {
        id: "bailout",
        label: "Bail out the bank",
        detail: "Costs 3% of GDP. Calms the panic.",
        apply: ({ n }) => {
          spend(n, 0.03);
          shock(n, { stability: 2, approval: -2 });
          return "The bailout calmed the markets, but taxpayers were not pleased.";
        },
      },
      {
        id: "fail",
        label: "Let it fail",
        detail: "Free, but growth drops sharply and jobs are lost.",
        apply: ({ n }) => {
          shock(n, { growth: -0.025, unemployment: 0.02, approval: -6 });
          return "The bank failed and a credit crunch followed.";
        },
      },
      {
        id: "guarantee",
        label: "Guarantee deposits only",
        detail: "Costs 1% of GDP. A middle path.",
        apply: ({ n }) => {
          spend(n, 0.01);
          shock(n, { growth: -0.01, approval: -2 });
          return "Savers were protected, shareholders were wiped out.";
        },
      },
    ],
  },
  {
    id: "disaster",
    title: "Devastating floods",
    cooldownMonths: 24,
    weight: () => 0.4,
    describe: () =>
      "Severe floods have displaced thousands of citizens and damaged farmland.",
    options: [
      {
        id: "relief",
        label: "Launch a relief programme",
        detail: "Costs 1.2% of GDP. Approval and stability rise.",
        apply: ({ n }) => {
          spend(n, 0.012);
          shock(n, { approval: 4, stability: 3 });
          return "Quick relief earned you public gratitude.";
        },
      },
      {
        id: "minimal",
        label: "Offer minimal aid",
        detail: "Free, but approval and stability fall.",
        apply: ({ n }) => {
          shock(n, { approval: -5, stability: -4 });
          return "Victims felt abandoned and anger spread.";
        },
      },
    ],
  },
  {
    id: "scandal",
    title: "Corruption scandal",
    cooldownMonths: 24,
    weight: (n) => (AUTHORITARIAN.has(n.governmentType) ? 0.2 : 0.35),
    describe: () =>
      "Leaked documents implicate a senior minister in corruption.",
    options: [
      {
        id: "inquiry",
        label: "Sack the minister and open an inquiry",
        detail:
          "A short-term hit, a lasting improvement in how the state works.",
        apply: ({ n }) => {
          shock(n, { approval: -1, stability: 1, growthBonus: 0.001 });
          return "The inquiry stung at first but restored some trust.";
        },
      },
      {
        id: "coverup",
        label: "Cover it up",
        detail: "A gamble: about a 45% chance it leaks and badly damages you.",
        apply: ({ n, rng }) => {
          if (rng.next() < 0.45) {
            shock(n, { approval: -12, stability: -6 });
            return "The cover-up was exposed and the backlash was brutal.";
          }
          return "The cover-up held. For now.";
        },
      },
    ],
  },
  {
    id: "investor",
    title: "Foreign investor offer",
    cooldownMonths: 24,
    weight: (n) =>
      n.policy.corporateTax <= n.baseline.corporateTax ? 0.5 : 0.25,
    describe: () =>
      "A multinational will build a huge plant here, if it is offered tax breaks.",
    options: [
      {
        id: "offer",
        label: "Offer tax breaks",
        detail:
          "Costs 0.5% of GDP. A lasting growth boost and fewer unemployed.",
        apply: ({ n }) => {
          spend(n, 0.005);
          shock(n, { growthBonus: 0.003, unemployment: -0.006, approval: 1 });
          return "The plant opened, bringing jobs and investment.";
        },
      },
      {
        id: "decline",
        label: "Decline",
        detail: "No cost, no change.",
        apply: () => "The investor took its plans elsewhere.",
      },
    ],
  },
  {
    id: "pandemic",
    title: "Outbreak of illness",
    cooldownMonths: 48,
    weight: () => 0.2,
    describe: () => "A fast-spreading illness is overwhelming hospitals.",
    options: [
      {
        id: "lockdown",
        label: "Impose a strict lockdown",
        detail: "Growth takes a big hit, but stability holds.",
        apply: ({ n }) => {
          shock(n, { growth: -0.03, approval: -2, stability: 2 });
          return "The lockdown slowed the outbreak at a heavy economic price.";
        },
      },
      {
        id: "targeted",
        label: "Targeted measures",
        detail: "Costs 1.5% of GDP. A balanced response.",
        apply: ({ n }) => {
          spend(n, 0.015);
          shock(n, { growth: -0.01, approval: 1 });
          return "Targeted measures kept hospitals afloat.";
        },
      },
      {
        id: "nothing",
        label: "Do nothing",
        detail: "Free, but approval and stability collapse.",
        apply: ({ n }) => {
          shock(n, { approval: -8, stability: -5, unemployment: 0.01 });
          return "Inaction was punished harshly by the public.";
        },
      },
    ],
  },
  {
    id: "migrants",
    title: "Migrants at the border",
    cooldownMonths: 30,
    weight: () => 0.3,
    describe: () =>
      "Thousands of migrants are gathering at the border and asking to enter.",
    options: [
      {
        id: "welcome",
        label: "Welcome them",
        detail:
          "Population grows, a little more unemployment, a small lasting growth gain.",
        apply: ({ n }) => {
          shock(n, {
            population: 1.012,
            approval: -2,
            unemployment: 0.004,
            growthBonus: 0.001,
          });
          return "Newcomers arrived, energising the workforce and dividing opinion.";
        },
      },
      {
        id: "quota",
        label: "Admit a limited number",
        detail: "Costs 0.3% of GDP. A modest compromise.",
        apply: ({ n }) => {
          spend(n, 0.003);
          shock(n, { population: 1.004 });
          return "A quota system admitted some and turned others away.";
        },
      },
      {
        id: "close",
        label: "Close the border",
        detail: "A small approval gain at home.",
        apply: ({ n }) => {
          shock(n, { approval: 1 });
          return "The border was sealed.";
        },
      },
    ],
  },
  {
    id: "tradeDispute",
    title: "Trade dispute",
    cooldownMonths: 18,
    needsTarget: true,
    weight: () => 0.5,
    describe: (_n, state, target) =>
      `${target === null ? "A neighbour" : state.nations[target]!.name} has slapped tariffs on your exports.`,
    options: [
      {
        id: "retaliate",
        label: "Retaliate with tariffs",
        detail: "Relations fall by 15. Growth dips, but the public cheers.",
        apply: ({ n, state, target }) => {
          if (target !== null) changeRelation(state, n.id, target, -15);
          shock(n, { growth: -0.003, approval: 2 });
          return "You hit back with tariffs and relations soured.";
        },
      },
      {
        id: "negotiate",
        label: "Negotiate",
        detail: "Costs 0.2% of GDP. Relations improve by 8.",
        apply: ({ n, state, target }) => {
          spend(n, 0.002);
          if (target !== null) changeRelation(state, n.id, target, 8);
          return "Talks defused the dispute.";
        },
      },
      {
        id: "ignore",
        label: "Ignore it",
        detail: "Approval dips.",
        apply: ({ n }) => {
          shock(n, { approval: -2 });
          return "Exporters felt abandoned.";
        },
      },
    ],
  },
  {
    id: "coup",
    title: "Whispers of a coup",
    cooldownMonths: 24,
    weight: (n) =>
      AUTHORITARIAN.has(n.governmentType) && n.stability < 50 ? 1 : 0,
    describe: () => "Senior officers are said to be plotting against you.",
    options: [
      {
        id: "purge",
        label: "Purge the officers",
        detail: "Stability rises, approval falls.",
        apply: ({ n }) => {
          shock(n, { stability: 4, approval: -3 });
          return "You crushed the plot, and made enemies.";
        },
      },
      {
        id: "pay",
        label: "Raise army pay",
        detail: "Costs 1% of GDP. Stability rises.",
        apply: ({ n }) => {
          spend(n, 0.01);
          shock(n, { stability: 6 });
          return "A generous pay rise bought the army's loyalty.";
        },
      },
      {
        id: "ignore",
        label: "Ignore the rumours",
        detail: "Stability falls.",
        apply: ({ n }) => {
          shock(n, { stability: -6 });
          return "The rumours kept growing.";
        },
      },
    ],
  },
  {
    id: "windfall",
    title: "Commodity windfall",
    cooldownMonths: 30,
    weight: (n) => (n.resourceRevenue > 0 ? 0.9 : 0.1),
    describe: () =>
      "Commodity prices have surged, delivering an unexpected windfall to the state.",
    options: [
      {
        id: "fund",
        label: "Save it in a sovereign fund",
        detail:
          "Adds 2% of GDP to the treasury and a small lasting growth gain.",
        apply: ({ n }) => {
          spend(n, -0.02);
          shock(n, { growthBonus: 0.002 });
          return "The windfall was invested for the future.";
        },
      },
      {
        id: "payout",
        label: "Pay it out to citizens",
        detail: "Adds 0.5% of GDP to the treasury and boosts approval.",
        apply: ({ n }) => {
          spend(n, -0.005);
          shock(n, { approval: 6 });
          return "Citizens enjoyed a popular cash dividend.";
        },
      },
    ],
  },
  {
    id: "rating",
    title: "Credit rating warning",
    cooldownMonths: 24,
    weight: (n) => (n.debt / n.gdp > 1.1 ? 0.9 : 0),
    describe: (n) =>
      `Ratings agencies warn that debt at ${pct(n.debt / n.gdp)} of GDP is unsustainable.`,
    options: [
      {
        id: "austerity",
        label: "Pledge austerity",
        detail: "Saves 0.5% of GDP now. Approval and growth suffer.",
        apply: ({ n }) => {
          spend(n, -0.005);
          shock(n, { approval: -4, growthBonus: -0.001 });
          return "Markets were reassured, voters were not.";
        },
      },
      {
        id: "defy",
        label: "Defy the markets",
        detail: "Inflation rises, stability dips, approval holds.",
        apply: ({ n }) => {
          shock(n, { inflation: 0.01, stability: -1, approval: 1 });
          return "You brushed off the warning. Borrowing costs crept up.";
        },
      },
    ],
  },
];

/** Put a specific decision in front of the player. */
export function triggerDecision(
  state: SimState,
  templateId: string,
  rng: Rng,
): boolean {
  const template = DECISION_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return false;
  const player = state.nations[state.playerCountryId]!;

  let target: number | null = null;
  if (template.needsTarget) {
    const others = state.nations.filter((n) => n.id !== player.id);
    target = others[rng.int(others.length)]!.id;
  }

  state.pendingDecision = {
    templateId,
    title: template.title,
    text: template.describe(player, state, target),
    target,
    options: template.options.map((o) => ({
      id: o.id,
      label: o.label,
      detail: o.detail,
    })),
    tick: state.tick,
  };
  markCooldown(state, `decision:${templateId}`);
  markCooldown(state, "decision:any");
  pushEvent(state, "warning", `Decision required: ${template.title}.`);
  return true;
}

/** Once a month there is a chance a crisis arises, weighted by the nation's situation. */
export function maybeTriggerDecision(state: SimState): void {
  if (state.pendingDecision || state.gameOver) return;
  if (onCooldown(state, "decision:any", 2)) return;
  const rng = createRng(mixSeed(state.seed, state.tick, 9001));
  if (rng.next() > 0.25) return;

  const player = state.nations[state.playerCountryId]!;
  const candidates: { id: string; weight: number }[] = [];
  let total = 0;
  for (const template of DECISION_TEMPLATES) {
    if (onCooldown(state, `decision:${template.id}`, template.cooldownMonths))
      continue;
    const weight = template.weight(player, state);
    if (weight > 0) {
      candidates.push({ id: template.id, weight });
      total += weight;
    }
  }
  if (candidates.length === 0) return;

  let roll = rng.range(0, total);
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      triggerDecision(state, candidate.id, rng);
      return;
    }
  }
  triggerDecision(state, candidates[candidates.length - 1]!.id, rng);
}

/** Apply the player's chosen option. Returns false if there is nothing to resolve. */
export function resolveDecision(state: SimState, optionId: string): boolean {
  const pending = state.pendingDecision;
  if (!pending) return false;
  const template = DECISION_TEMPLATES.find((t) => t.id === pending.templateId);
  const option = template?.options.find((o) => o.id === optionId);
  if (!template || !option) return false;

  const player = state.nations[state.playerCountryId]!;
  const rng = createRng(mixSeed(state.seed, state.tick, 777));
  const outcome = option.apply({
    n: player,
    state,
    target: pending.target,
    rng,
  });
  pushEvent(state, "info", `${template.title}: ${outcome}`);
  state.pendingDecision = null;
  return true;
}
