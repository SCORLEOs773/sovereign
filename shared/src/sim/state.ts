import { z } from "zod";
import { SimSpeedSchema } from "./speed";

export const SimStateSchema = z.object({
  tick: z.number().int().min(0),
  hours: z.number().int().min(0),
  days: z.number().int().min(0),
  months: z.number().int().min(0),
});
export type SimState = z.infer<typeof SimStateSchema>;

export const SimSnapshotSchema = z.object({
  version: z.literal(1),
  worldSeed: z.number().int(),
  speed: SimSpeedSchema,
  state: SimStateSchema,
  /** Real-world time of the save, in milliseconds since 1970 */
  savedAt: z.number(),
});
export type SimSnapshot = z.infer<typeof SimSnapshotSchema>;

export function createInitialSimState(): SimState {
  return { tick: 0, hours: 0, days: 0, months: 0 };
}
