import { createRng, mixSeed } from "../world/random";
import type { ArchetypeId } from "../world/countryData";
import type { Country } from "../world/types";
import {
  ADMIN_SPENDING,
  approvalTarget,
  computeBudget,
  growthTarget,
  stabilityTarget,
} from "./economy";
import { equipmentTarget } from "./military";
import {
  SPENDING_KEYS,
  clamp,
  clonePolicy,
  type Policy,
  type Spending,
  type SpendingKey,
} from "./policy";
import type { NationState } from "./state";

interface ArchetypeStart {
  inflation: number;
  unemployment: number;
  popGrowth: number;
  /** Extra government income from resources, as a share of GDP */
  resourceRevenue: number;
}

const ARCHETYPE_START: Record<ArchetypeId, ArchetypeStart> = {
  industrial: {
    inflation: 0.02,
    unemployment: 0.05,
    popGrowth: 0.006,
    resourceRevenue: 0,
  },
  "wealthy-aging": {
    inflation: 0.018,
    unemployment: 0.045,
    popGrowth: 0.001,
    resourceRevenue: 0,
  },
  developing: {
    inflation: 0.055,
    unemployment: 0.1,
    popGrowth: 0.022,
    resourceRevenue: 0,
  },
  "resource-rich": {
    inflation: 0.04,
    unemployment: 0.08,
    popGrowth: 0.014,
    resourceRevenue: 0.05,
  },
  "military-debt": {
    inflation: 0.06,
    unemployment: 0.07,
    popGrowth: 0.009,
    resourceRevenue: 0,
  },
  trader: {
    inflation: 0.025,
    unemployment: 0.06,
    popGrowth: 0.012,
    resourceRevenue: 0,
  },
  island: {
    inflation: 0.02,
    unemployment: 0.055,
    popGrowth: 0.008,
    resourceRevenue: 0,
  },
};

/** Build the starting economy of a nation from its generated country profile. */
export function createNation(country: Country, seed: number): NationState {
  const start = ARCHETYPE_START[country.archetypeId];
  const rng = createRng(mixSeed(seed, 7, country.id));

  const spending: Spending = {
    health: 0,
    education: 0,
    infrastructure: 0,
    defence: 0,
    welfare: 0,
  };
  const policy: Policy = {
    incomeTax: 0.25,
    corporateTax: 0.2,
    interestRate: 0.04,
    spending,
  };

  const nation: NationState = {
    id: country.id,
    name: country.name,
    region: country.region,
    governmentType: country.governmentType,
    x: country.capital.x,
    y: country.capital.y,
    population: country.population,
    gdp: country.gdp,
    treasury: country.gdp * 0.03,
    debt: (country.gdp * country.debtPercentGdp) / 100,
    inflation: start.inflation,
    unemployment: start.unemployment,
    approval: country.approval,
    stability: country.stability,
    growth: 0,
    baseGrowth: 0,
    baseUnemployment: start.unemployment,
    baseInflation: start.inflation,
    baseApproval: country.approval,
    basePopGrowth: start.popGrowth,
    resourceRevenue: start.resourceRevenue,
    approvalBias: 0,
    stabilityBias: 0,
    lowStabilityMonths: 0,
    growthBonus: 0,
    tradeBonus: 0,
    sanctionPenalty: 0,
    army: country.armyPersonnel,
    equipment: 50,
    armyRate: country.armyPersonnel / country.population,
    warWeariness: 0,
    warCostRate: 0,
    warPenalty: 0,
    policy,
    baseline: clonePolicy(policy),
    personality: {
      thrift: rng.range(0.2, 0.9),
      welfare: rng.range(0.1, 0.9),
      growth: rng.range(0.2, 0.9),
      militarism: clamp(
        rng.range(0.1, 0.7) +
          (country.archetypeId === "military-debt" ? 0.3 : 0),
        0,
        1,
      ),
    },
  };

  // Calibrate spending so the starting budget runs a small (about 1% of GDP) deficit
  const initial = computeBudget(nation);
  const revenueRatio = initial.revenue / nation.gdp;
  const interestRatio = initial.interest / nation.gdp;
  const nonInterest = Math.max(0.1, revenueRatio + 0.01 - interestRatio);
  const programmes = Math.max(0.06, nonInterest - ADMIN_SPENDING);

  const armyRate = country.armyPersonnel / country.population;
  const weights: Record<SpendingKey, number> = {
    health: 0.27,
    education: 0.19,
    infrastructure: 0.14,
    welfare: 0.3,
    defence: clamp(0.06 + armyRate * 10, 0.07, 0.25),
  };
  let totalWeight = 0;
  for (const key of SPENDING_KEYS) totalWeight += weights[key];
  for (const key of SPENDING_KEYS)
    spending[key] = (programmes * weights[key]) / totalWeight;
  nation.baseline = clonePolicy(policy);

  // Equipment starts in balance with the starting defence budget
  nation.equipment = equipmentTarget(nation);

  // Starting growth is the neutral reference for later changes
  nation.growth = growthTarget(nation, 0);
  nation.baseGrowth = nation.growth;

  // Calibrate so that "no change" keeps approval and stability where they started
  nation.approvalBias = 0;
  nation.approvalBias = nation.approval - approvalTarget(nation);
  nation.stabilityBias = 0;
  nation.stabilityBias = nation.stability - stabilityTarget(nation);

  return nation;
}
