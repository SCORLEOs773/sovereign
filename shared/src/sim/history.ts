import type { NationState, SimState } from "./state";

const MAX_POINTS = 120;

/** Record one monthly data point of the player's nation. */
export function recordHistory(state: SimState, nation: NationState): void {
  const h = state.history;
  h.ticks.push(state.tick);
  h.gdp.push(nation.gdp);
  h.population.push(nation.population);
  h.approval.push(nation.approval);
  h.inflation.push(nation.inflation);
  h.unemployment.push(nation.unemployment);
  h.treasury.push(nation.treasury);
  h.debt.push(nation.debt);

  for (const series of [
    h.ticks,
    h.gdp,
    h.population,
    h.approval,
    h.inflation,
    h.unemployment,
    h.treasury,
    h.debt,
  ]) {
    if (series.length > MAX_POINTS)
      series.splice(0, series.length - MAX_POINTS);
  }
}
