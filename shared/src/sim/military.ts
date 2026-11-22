import { clamp } from "./policy";
import type { NationState } from "./state";

/** Annual defence money per soldier at which equipment quality reaches about 63. */
export const EQUIPMENT_COST_REF = 150_000;

/** The equipment quality the current defence budget can sustain. */
export function equipmentTarget(n: NationState): number {
  const perSoldier =
    (n.gdp * n.policy.spending.defence) / Math.max(1000, n.army);
  return clamp(100 * (1 - Math.exp(-perSoldier / EQUIPMENT_COST_REF)), 5, 100);
}

/** The army size the nation recruits towards, driven by defence spending against its starting level. */
export function armyTarget(n: NationState): number {
  const ratio =
    n.policy.spending.defence / Math.max(0.001, n.baseline.spending.defence);
  return n.population * n.armyRate * clamp(Math.pow(ratio, 0.6), 0.5, 2);
}

/** Infrastructure spending keeps armies supplied. */
export function logisticsFactor(n: NationState): number {
  const ratio =
    n.policy.spending.infrastructure /
    Math.max(0.001, n.baseline.spending.infrastructure);
  return clamp(0.85 + 0.15 * ratio, 0.75, 1.15);
}

/** One number for how strong a nation's military is. */
export function militaryPower(n: NationState): number {
  return n.army * (0.4 + 0.006 * n.equipment) * logisticsFactor(n);
}

/** Monthly update: recruitment and equipment slowly follow the defence budget. */
export function stepMilitary(n: NationState, atWar: boolean): void {
  n.army = Math.max(
    1000,
    n.army + (armyTarget(n) - n.army) * (atWar ? 0.06 : 0.03),
  );
  n.equipment = clamp(
    n.equipment + (equipmentTarget(n) - n.equipment) * 0.03,
    0,
    100,
  );
  if (!atWar) n.warWeariness = Math.max(0, n.warWeariness - 5);
}
