import { z } from "zod";
import { PolicyPatchSchema } from "./policy";
import { SimSpeedSchema, type SimSpeed } from "./speed";
import { SimSnapshotSchema, TreatyKindSchema, type SimState } from "./state";

/** Commands the UI sends to the simulation. Always validated before use. */
export const SimCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("init"),
    worldSeed: z.number().int(),
    /** Required for a new campaign (when snapshot is null) */
    playerCountryId: z.number().int().min(0).nullable(),
    snapshot: SimSnapshotSchema.nullable(),
    offlineSeconds: z.number().min(0),
  }),
  z.object({ type: z.literal("setSpeed"), speed: SimSpeedSchema }),
  z.object({ type: z.literal("setPolicy"), policy: PolicyPatchSchema }),
  z.object({ type: z.literal("resolveDecision"), optionId: z.string() }),
  z.object({
    type: z.literal("improveRelations"),
    target: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("proposeTreaty"),
    target: z.number().int().min(0),
    kind: TreatyKindSchema,
  }),
  z.object({ type: z.literal("cancelTreaty"), treatyId: z.number().int() }),
  z.object({
    type: z.literal("setSanctions"),
    target: z.number().int().min(0),
    active: z.boolean(),
  }),
  z.object({
    type: z.literal("respondProposal"),
    proposalId: z.number().int(),
    accept: z.boolean(),
  }),
  z.object({ type: z.literal("declareWar"), target: z.number().int().min(0) }),
  z.object({ type: z.literal("proposePeace"), warId: z.number().int() }),
  z.object({ type: z.literal("demandSurrender"), warId: z.number().int() }),
]);
export type SimCommand = z.infer<typeof SimCommandSchema>;

export interface OfflineReport {
  ticks: number;
  capped: boolean;
  elapsedSeconds: number;
}

/** Events the simulation sends back to the UI. */
export type SimEvent =
  | {
      type: "ready";
      worldSeed: number;
      speed: SimSpeed;
      state: SimState;
      offline: OfflineReport;
    }
  | {
      type: "state";
      speed: SimSpeed;
      state: SimState;
    };
