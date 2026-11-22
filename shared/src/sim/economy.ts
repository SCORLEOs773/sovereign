import type { Rng } from "../world/random";
import { SPENDING_KEYS, clamp } from "./policy";
import type { NationState } from "./state";

export const LABOUR_SHARE = 0.55;
export const PROFIT_SHARE = 0.25;
export const OTHER_REVENUE = 0.1;
export const ADMIN_SPENDING = 0.03;

export interface Budget {
  income: number;
  corporate: number;
  other: number;
  revenue: number;
  programmes: number;
  administration: number;
  interest: number;
  spending: number;
  balance: number;
}

/** Share of a tax base actually collected. Very high rates leak through evasion. */
export function collect(rate: number): number {
  return rate * (1 - 0.9 * rate * rate);
}

/** Poorer states are worse at collecting taxes. */
export function revenueCapacity(gdpPerCapita: number): number {
  return 0.6 + 0.4 * Math.min(1, gdpPerCapita / 40000);
}

export function debtInterestRate(n: NationState): number {
  const ratio = n.debt / n.gdp;
  return 0.01 + 0.6 * n.policy.interestRate + 0.04 * Math.max(0, ratio - 0.9);
}

/** Annual budget implied by the nation's current policy. */
export function computeBudget(n: NationState): Budget {
  const p = n.policy;
  const capacity = revenueCapacity(n.gdp / n.population);
  const income = n.gdp * LABOUR_SHARE * collect(p.incomeTax) * capacity;
  const corporate = n.gdp * PROFIT_SHARE * collect(p.corporateTax) * capacity;
  const other = n.gdp * (OTHER_REVENUE * capacity + n.resourceRevenue);
  const revenue = income + corporate + other;

  let programmes = 0;
  for (const key of SPENDING_KEYS) programmes += n.gdp * p.spending[key];
  const administration = n.gdp * ADMIN_SPENDING;
  const interest = n.debt * debtInterestRate(n);
  const spending = programmes + administration + interest;

  return {
    income,
    corporate,
    other,
    revenue,
    programmes,
    administration,
    interest,
    spending,
    balance: revenue - spending,
  };
}

/** Deviation from the starting policy, capped so extreme settings stay bounded. */
function delta(value: number, reference: number, limit: number): number {
  return clamp(value - reference, -limit, limit);
}

export function growthTarget(n: NationState, noise: number): number {
  const p = n.policy;
  const b = n.baseline;
  const gdpPerCapita = n.gdp / n.population;
  const debtRatio = n.debt / n.gdp;

  const g =
    0.015 +
    0.03 * (1 - Math.min(1, gdpPerCapita / 60000)) +
    0.3 * delta(p.spending.infrastructure, b.spending.infrastructure, 0.04) +
    0.2 * delta(p.spending.education, b.spending.education, 0.04) +
    0.12 * delta(p.spending.health, b.spending.health, 0.04) -
    0.1 * delta(p.incomeTax, b.incomeTax, 0.2) -
    0.15 * delta(p.corporateTax, b.corporateTax, 0.2) -
    0.5 * delta(p.interestRate, b.interestRate, 0.05) -
    0.4 * Math.max(0, n.inflation - 0.05) -
    0.03 * Math.max(0, (50 - n.stability) / 50) -
    0.02 * Math.max(0, debtRatio - 1) +
    n.growthBonus +
    n.tradeBonus -
    n.sanctionPenalty +
    noise;

  return clamp(g, -0.12, 0.1);
}

export function approvalTarget(n: NationState): number {
  const p = n.policy;
  const b = n.baseline;
  const debtRatio = n.debt / n.gdp;

  return (
    n.approvalBias +
    600 * (n.growth - n.baseGrowth) -
    150 * (n.unemployment - n.baseUnemployment) -
    120 *
      (Math.max(0, n.inflation - 0.03) - Math.max(0, n.baseInflation - 0.03)) -
    100 * delta(p.incomeTax, b.incomeTax, 0.2) +
    250 * delta(p.spending.health, b.spending.health, 0.05) +
    200 * delta(p.spending.education, b.spending.education, 0.05) +
    250 * delta(p.spending.welfare, b.spending.welfare, 0.05) +
    120 * delta(p.spending.infrastructure, b.spending.infrastructure, 0.05) -
    10 * Math.max(0, debtRatio - 1.2)
  );
}

export function stabilityTarget(n: NationState): number {
  return (
    n.stabilityBias +
    0.5 * (n.approval - n.baseApproval) -
    1.2 * Math.max(0, 35 - n.approval) -
    150 * Math.max(0, n.inflation - 0.1) -
    120 * Math.max(0, n.unemployment - 0.15)
  );
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Last line of defence: keep every value finite and inside a sane range. */
function sanitize(n: NationState): void {
  n.population = Math.max(1000, finiteOr(n.population, 1000));
  n.gdp = Math.max(1e6, finiteOr(n.gdp, 1e6));
  n.treasury = Math.max(0, finiteOr(n.treasury, 0));
  n.debt = Math.max(0, finiteOr(n.debt, 0));
  n.inflation = clamp(finiteOr(n.inflation, 0.02), -0.05, 0.8);
  n.unemployment = clamp(finiteOr(n.unemployment, 0.05), 0.01, 0.5);
  n.growth = clamp(finiteOr(n.growth, 0), -0.2, 0.15);
  n.approval = clamp(finiteOr(n.approval, 50), 0, 100);
  n.stability = clamp(finiteOr(n.stability, 50), 0, 100);
}

/** Advance one nation's economy by one month. */
export function stepEconomy(n: NationState, rng: Rng): void {
  const p = n.policy;
  const b = n.baseline;
  const budget = computeBudget(n);
  const deficit = (budget.spending - budget.revenue) / n.gdp;

  // Treasury and debt: overdrafts become borrowing, big surpluses repay debt
  n.treasury += budget.balance / 12;
  if (n.treasury < 0) {
    n.debt -= n.treasury;
    n.treasury = 0;
  } else {
    const buffer = 0.03 * n.gdp;
    if (n.debt > 0 && n.treasury > buffer) {
      const repay = Math.min(n.debt, n.treasury - buffer);
      n.debt -= repay;
      n.treasury -= repay;
    }
  }

  // Growth and GDP
  n.growth += (growthTarget(n, rng.range(-0.008, 0.008)) - n.growth) * 0.25;
  n.gdp *= Math.pow(1 + n.growth, 1 / 12);

  // Population
  const popRate = clamp(
    n.basePopGrowth +
      0.3 * delta(p.spending.health, b.spending.health, 0.04) +
      (0.004 * (n.approval - 50)) / 50 -
      0.01 * Math.max(0, n.unemployment - 0.15),
    -0.02,
    0.04,
  );
  n.population *= Math.pow(1 + popRate, 1 / 12);

  // Inflation
  const inflationTarget = clamp(
    n.baseInflation +
      0.6 * clamp(deficit - 0.01, -0.05, 0.15) +
      0.5 * (n.growth - n.baseGrowth) -
      0.8 * delta(p.interestRate, b.interestRate, 0.1) +
      rng.range(-0.002, 0.002),
    -0.02,
    0.6,
  );
  n.inflation += (inflationTarget - n.inflation) * 0.15;

  // Unemployment
  const unemploymentTarget = clamp(
    n.baseUnemployment -
      1.2 * (n.growth - n.baseGrowth) +
      0.8 * delta(p.interestRate, b.interestRate, 0.1),
    0.01,
    0.4,
  );
  n.unemployment += (unemploymentTarget - n.unemployment) * 0.1;

  // Public mood
  n.approval = clamp(
    n.approval + (approvalTarget(n) - n.approval) * 0.12,
    0,
    100,
  );
  n.stability = clamp(
    n.stability + (stabilityTarget(n) - n.stability) * 0.08,
    0,
    100,
  );

  sanitize(n);
}
