import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  game: z.string(),
  version: z.string(),
  serverTime: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
