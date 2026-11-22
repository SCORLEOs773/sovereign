import { z } from "zod";
import { PolicySchema } from "./policy";
import { SimSpeedSchema } from "./speed";

export const TREATY_KINDS = ["trade", "nonAggression", "alliance"] as const;
export type TreatyKind = (typeof TREATY_KINDS)[number];
export const TreatyKindSchema = z.enum(TREATY_KINDS);

export const PersonalitySchema = z.object({
  /** 0..1: dislike of deficits and debt */
  thrift: z.number(),
  /** 0..1: priority of welfare and health */
  welfare: z.number(),
  /** 0..1: priority of growth (infrastructure and education) */
  growth: z.number(),
  /** 0..1: priority of defence */
  militarism: z.number(),
});

export const NationStateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  region: z.string(),
  governmentType: z.string(),
  /** Capital position on the world map */
  x: z.number(),
  y: z.number(),
  population: z.number(),
  /** Annual GDP in US dollars */
  gdp: z.number(),
  treasury: z.number(),
  debt: z.number(),
  inflation: z.number(),
  unemployment: z.number(),
  approval: z.number(),
  stability: z.number(),
  /** Smoothed annual real growth rate */
  growth: z.number(),
  baseGrowth: z.number(),
  baseUnemployment: z.number(),
  baseInflation: z.number(),
  baseApproval: z.number(),
  basePopGrowth: z.number(),
  resourceRevenue: z.number(),
  approvalBias: z.number(),
  stabilityBias: z.number(),
  lowStabilityMonths: z.number().int(),
  /** Permanent growth modifier from decisions */
  growthBonus: z.number(),
  /** Growth from trade agreements and alliances, refreshed monthly */
  tradeBonus: z.number(),
  /** Growth lost to sanctions, refreshed monthly */
  sanctionPenalty: z.number(),
  /** Active-duty personnel */
  army: z.number(),
  /** Equipment quality, 0..100 */
  equipment: z.number(),
  /** Share of the population the nation recruits at its starting defence budget */
  armyRate: z.number(),
  /** 0..100, builds while at war and fades in peace */
  warWeariness: z.number(),
  /** Extra annual cost of fighting, as a share of GDP, refreshed monthly */
  warCostRate: z.number(),
  /** Growth lost to war and occupation, refreshed monthly */
  warPenalty: z.number(),
  policy: PolicySchema,
  /** The policy the nation started with, used as the neutral reference point */
  baseline: PolicySchema,
  personality: PersonalitySchema,
});

export const GameEventSchema = z.object({
  tick: z.number().int(),
  kind: z.enum(["info", "good", "warning", "crisis"]),
  text: z.string(),
});

export const HistorySchema = z.object({
  ticks: z.array(z.number()),
  gdp: z.array(z.number()),
  population: z.array(z.number()),
  approval: z.array(z.number()),
  inflation: z.array(z.number()),
  unemployment: z.array(z.number()),
  treasury: z.array(z.number()),
  debt: z.array(z.number()),
  power: z.array(z.number()),
});

export const GameOverSchema = z.object({
  reason: z.enum(["election", "collapse", "retirement", "conquest"]),
  tick: z.number().int(),
});

export const TreatySchema = z.object({
  id: z.number().int(),
  kind: TreatyKindSchema,
  a: z.number().int(),
  b: z.number().int(),
  since: z.number().int(),
});

export const SanctionSchema = z.object({
  by: z.number().int(),
  target: z.number().int(),
  since: z.number().int(),
});

/** A treaty offer from an AI nation to the player */
export const ProposalSchema = z.object({
  id: z.number().int(),
  from: z.number().int(),
  kind: TreatyKindSchema,
  tick: z.number().int(),
  expires: z.number().int(),
});

export const OccupationSchema = z.object({
  holder: z.number().int(),
  victim: z.number().int(),
  /** Share of the victim's territory held, 0..1 */
  fraction: z.number(),
});

export const WarSchema = z.object({
  id: z.number().int(),
  /** The first entry is the leader, the rest are allies who joined */
  attackers: z.array(z.number().int()),
  defenders: z.array(z.number().int()),
  start: z.number().int(),
  months: z.number().int(),
  /** -100..100, positive favours the attackers */
  score: z.number(),
  occupations: z.array(OccupationSchema),
});

export const TruceSchema = z.object({
  a: z.number().int(),
  b: z.number().int(),
  until: z.number().int(),
});

export const DecisionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
});

export const PendingDecisionSchema = z.object({
  templateId: z.string(),
  title: z.string(),
  text: z.string(),
  target: z.number().int().nullable(),
  other: z.number().int().nullable(),
  options: z.array(DecisionOptionSchema),
  tick: z.number().int(),
});

export const SimStateSchema = z.object({
  tick: z.number().int().min(0),
  hours: z.number().int().min(0),
  days: z.number().int().min(0),
  months: z.number().int().min(0),
  seed: z.number().int(),
  playerCountryId: z.number().int(),
  nations: z.array(NationStateSchema),
  events: z.array(GameEventSchema),
  /** Last tick each alert or cooldown fired */
  alerts: z.record(z.string(), z.number()),
  /** Monthly history of the player's nation */
  history: HistorySchema,
  gameOver: GameOverSchema.nullable(),
  /** relations[a][b] is how nation a feels about b, from -100 to 100 (kept symmetric) */
  relations: z.array(z.array(z.number())),
  treaties: z.array(TreatySchema),
  sanctions: z.array(SanctionSchema),
  proposals: z.array(ProposalSchema),
  pendingDecision: PendingDecisionSchema.nullable(),
  nextId: z.number().int(),
  electionsWon: z.number().int(),
  startGdp: z.number(),
  /** adjacency[id] lists the nations sharing a land border with nation id */
  adjacency: z.array(z.array(z.number().int())),
  wars: z.array(WarSchema),
  truces: z.array(TruceSchema),
  warsWon: z.number().int(),
});

export const SimSnapshotSchema = z.object({
  version: z.literal(3),
  worldSeed: z.number().int(),
  speed: SimSpeedSchema,
  state: SimStateSchema,
  /** Real-world time of the save, in milliseconds since 1970 */
  savedAt: z.number(),
});

export type Personality = z.infer<typeof PersonalitySchema>;
export type NationState = z.infer<typeof NationStateSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type History = z.infer<typeof HistorySchema>;
export type GameOver = z.infer<typeof GameOverSchema>;
export type Treaty = z.infer<typeof TreatySchema>;
export type Sanction = z.infer<typeof SanctionSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type Occupation = z.infer<typeof OccupationSchema>;
export type War = z.infer<typeof WarSchema>;
export type Truce = z.infer<typeof TruceSchema>;
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type PendingDecision = z.infer<typeof PendingDecisionSchema>;
export type SimState = z.infer<typeof SimStateSchema>;
export type SimSnapshot = z.infer<typeof SimSnapshotSchema>;

export function createEmptyHistory(): History {
  return {
    ticks: [],
    gdp: [],
    population: [],
    approval: [],
    inflation: [],
    unemployment: [],
    treasury: [],
    debt: [],
    power: [],
  };
}
