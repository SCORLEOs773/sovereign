import { z } from "zod";
import { PolicySchema } from "./policy";
import { SimSpeedSchema } from "./speed";

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
  governmentType: z.string(),
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
});

export const GameOverSchema = z.object({
  reason: z.enum(["election", "collapse"]),
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
  /** Last tick each alert fired, used for cooldowns */
  alerts: z.record(z.string(), z.number()),
  /** Monthly history of the player's nation */
  history: HistorySchema,
  gameOver: GameOverSchema.nullable(),
});

export const SimSnapshotSchema = z.object({
  version: z.literal(2),
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
  };
}
