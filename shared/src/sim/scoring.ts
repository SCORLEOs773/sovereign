import { countTreaties } from "./diplomacy";
import { hasElections } from "./monthly";
import type { SimState } from "./state";
import { SIM_CONFIG, TICKS_PER_DAY, tickToDate } from "./time";

export interface Objective {
  id: string;
  title: string;
  description: string;
  /** 0..1 */
  progress: number;
  status: string;
  done: boolean;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function getObjectives(state: SimState): Objective[] {
  const p = state.nations[state.playerCountryId]!;
  const total = state.nations.length;
  const rank = 1 + state.nations.filter((n) => n.gdp > p.gdp).length;
  const trade = countTreaties(state, p.id, "trade");
  const alliances = countTreaties(state, p.id, "alliance");
  const debtRatio = p.debt / p.gdp;
  const growth = p.gdp / state.startGdp;
  const year = tickToDate(state.tick).getUTCFullYear();

  const politics: Objective = hasElections(p.governmentType)
    ? {
        id: "elections",
        title: "Win two elections",
        description: "Be re-elected twice.",
        progress: clamp01(state.electionsWon / 2),
        status: `${state.electionsWon} / 2`,
        done: state.electionsWon >= 2,
      }
    : {
        id: "tenure",
        title: "Hold power until 2040",
        description: "Keep your grip on the country for eight years.",
        progress: clamp01((year - SIM_CONFIG.startYear) / 8),
        status: `${year}`,
        done: year >= 2040,
      };

  return [
    {
      id: "growth",
      title: "Grow the economy",
      description: "Increase GDP by 50% from where you started.",
      progress: clamp01((growth - 1) / 0.5),
      status: `${((growth - 1) * 100).toFixed(0)}% of 50%`,
      done: growth >= 1.5,
    },
    {
      id: "rank",
      title: "Top five economy",
      description: "Climb into the world's five largest economies.",
      progress: clamp01((total - rank) / Math.max(1, total - 5)),
      status: `Rank #${rank}`,
      done: rank <= 5,
    },
    politics,
    {
      id: "trade",
      title: "Open for business",
      description: "Sign three trade agreements.",
      progress: clamp01(trade / 3),
      status: `${trade} / 3`,
      done: trade >= 3,
    },
    {
      id: "alliance",
      title: "Find a friend",
      description: "Forge an alliance with another nation.",
      progress: clamp01(alliances / 1),
      status: `${alliances} / 1`,
      done: alliances >= 1,
    },
    {
      id: "debt",
      title: "Tame the debt",
      description: "Bring national debt below 60% of GDP.",
      progress: debtRatio < 0.6 ? 1 : clamp01(0.6 / debtRatio),
      status: `${(debtRatio * 100).toFixed(0)}% of GDP`,
      done: debtRatio < 0.6,
    },
    {
      id: "approval",
      title: "Beloved leader",
      description: "Reach 65% approval.",
      progress: clamp01(p.approval / 65),
      status: `${p.approval.toFixed(0)}%`,
      done: p.approval >= 65,
    },
  ];
}

/** Legacy score: higher is better. */
export function computeScore(state: SimState): number {
  const p = state.nations[state.playerCountryId]!;
  const years = state.tick / TICKS_PER_DAY / 365.25;
  const completed = getObjectives(state).filter((o) => o.done).length;
  const score =
    100 * (p.gdp / state.startGdp) +
    2 * p.approval +
    p.stability +
    25 * countTreaties(state, p.id, "trade") +
    40 * countTreaties(state, p.id, "alliance") +
    100 * state.electionsWon +
    10 * years +
    50 * completed;
  return Math.round(score);
}
