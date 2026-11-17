import type { Rng } from "../world/random";
import { computeBudget } from "./economy";
import {
  POLICY_LIMITS,
  SPENDING_KEYS,
  clamp,
  type SpendingKey,
} from "./policy";
import type { NationState } from "./state";

const STEP_TAX = 0.005;
const STEP_SPEND = 0.0025;

/**
 * Rule-based government AI. Each month a nation looks at its deficit, debt,
 * inflation, unemployment and approval and nudges its policy, shaped by its personality.
 */
export function runAiPolicy(n: NationState, rng: Rng): void {
  const budget = computeBudget(n);
  const deficit = (budget.spending - budget.revenue) / n.gdp;
  const debtRatio = n.debt / n.gdp;
  const p = n.policy;
  const b = n.baseline;
  const pers = n.personality;

  const priority = (key: SpendingKey): number => {
    switch (key) {
      case "welfare":
        return 0.3 + 0.7 * pers.welfare;
      case "health":
        return 0.5 + 0.3 * pers.welfare;
      case "education":
        return 0.4 + 0.5 * pers.growth;
      case "infrastructure":
        return 0.3 + 0.7 * pers.growth;
      case "defence":
        return 0.2 + 0.8 * pers.militarism;
    }
  };

  const floorOf = (key: SpendingKey): number => b.spending[key] * 0.4;
  const capOf = (key: SpendingKey): number =>
    Math.min(POLICY_LIMITS.spending.max, b.spending[key] * 2 + 0.01);

  const cutLeastImportant = (): void => {
    let chosen: SpendingKey | null = null;
    for (const key of SPENDING_KEYS) {
      if (p.spending[key] - STEP_SPEND < floorOf(key)) continue;
      if (chosen === null || priority(key) < priority(chosen)) chosen = key;
    }
    if (chosen !== null) p.spending[chosen] -= STEP_SPEND;
  };

  const investMostImportant = (): void => {
    let chosen: SpendingKey | null = null;
    for (const key of SPENDING_KEYS) {
      if (p.spending[key] + STEP_SPEND > capOf(key)) continue;
      if (chosen === null || priority(key) > priority(chosen)) chosen = key;
    }
    if (chosen !== null) p.spending[chosen] += STEP_SPEND;
  };

  // 1. Fiscal discipline
  const deficitLimit = 0.02 + 0.04 * (1 - pers.thrift);
  const debtLimit = 0.8 + 0.8 * (1 - pers.thrift);
  if (deficit > deficitLimit || debtRatio > debtLimit) {
    if (rng.next() < 0.5 + 0.3 * pers.thrift) p.incomeTax += STEP_TAX;
    else cutLeastImportant();
  } else if (deficit < -0.01 && debtRatio < 0.6) {
    if (n.approval < 55) p.incomeTax -= STEP_TAX;
    else investMostImportant();
  }

  // 2. Jobs
  if (n.unemployment > n.baseUnemployment + 0.03 && deficit < deficitLimit) {
    p.corporateTax -= 0.0025;
    if (rng.next() < 0.5 + 0.4 * pers.growth)
      p.spending.infrastructure += STEP_SPEND;
  }

  // 3. Prices
  if (n.inflation > 0.05) p.interestRate += 0.0025;
  else if (n.inflation < 0.01 && n.unemployment > n.baseUnemployment)
    p.interestRate -= 0.0025;

  // 4. Popularity
  if (n.approval < 40) {
    if (rng.next() < 0.5) p.incomeTax -= 0.0025;
    else p.spending.welfare += STEP_SPEND;
  }

  // Keep every nation within a believable band around where it started
  p.incomeTax = clamp(
    p.incomeTax,
    Math.max(0.05, b.incomeTax - 0.1),
    Math.min(POLICY_LIMITS.incomeTax.max, b.incomeTax + 0.12),
  );
  p.corporateTax = clamp(
    p.corporateTax,
    Math.max(0.05, b.corporateTax - 0.08),
    b.corporateTax + 0.1,
  );
  p.interestRate = clamp(p.interestRate, 0.005, 0.12);
  for (const key of SPENDING_KEYS) {
    p.spending[key] = clamp(p.spending[key], floorOf(key), capOf(key));
  }
}
