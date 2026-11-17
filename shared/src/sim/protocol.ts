import { z } from "zod";
import { PolicyPatchSchema } from "./policy";
import { SimSpeedSchema, type SimSpeed } from "./speed";
import { SimSnapshotSchema, type SimState } from "./state";

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
  z.object({
    type: z.literal("setSpeed"),
    speed: SimSpeedSchema,
  }),
  z.object({
    type: z.literal("setPolicy"),
    policy: PolicyPatchSchema,
  }),
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
