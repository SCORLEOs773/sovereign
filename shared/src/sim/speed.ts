import { z } from "zod";

/** 0 means paused. */
export const SIM_SPEEDS = [0, 1, 2, 5, 10] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

export const SimSpeedSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(5),
  z.literal(10),
]);
