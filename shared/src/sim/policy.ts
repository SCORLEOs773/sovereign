import { z } from "zod";

export const SPENDING_KEYS = [
  "health",
  "education",
  "infrastructure",
  "defence",
  "welfare",
] as const;
export type SpendingKey = (typeof SPENDING_KEYS)[number];

export const SpendingSchema = z.object({
  health: z.number(),
  education: z.number(),
  infrastructure: z.number(),
  defence: z.number(),
  welfare: z.number(),
});

export const PolicySchema = z.object({
  incomeTax: z.number(),
  corporateTax: z.number(),
  interestRate: z.number(),
  spending: SpendingSchema,
});

export type Spending = z.infer<typeof SpendingSchema>;
export type Policy = z.infer<typeof PolicySchema>;

/** All rates are fractions: 0.25 means 25% (spending is a share of GDP). */
export const POLICY_LIMITS = {
  incomeTax: { min: 0, max: 0.6 },
  corporateTax: { min: 0, max: 0.5 },
  interestRate: { min: 0, max: 0.15 },
  spending: { min: 0, max: 0.2 },
} as const;

export const PolicyPatchSchema = z.object({
  incomeTax: z.number().optional(),
  corporateTax: z.number().optional(),
  interestRate: z.number().optional(),
  spending: SpendingSchema.partial().optional(),
});
export type PolicyPatch = z.infer<typeof PolicyPatchSchema>;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clonePolicy(policy: Policy): Policy {
  return { ...policy, spending: { ...policy.spending } };
}

/** Applies a partial policy change, clamping every value to its legal range. */
export function applyPolicyPatch(policy: Policy, patch: PolicyPatch): void {
  const L = POLICY_LIMITS;
  if (patch.incomeTax !== undefined && Number.isFinite(patch.incomeTax)) {
    policy.incomeTax = clamp(patch.incomeTax, L.incomeTax.min, L.incomeTax.max);
  }
  if (patch.corporateTax !== undefined && Number.isFinite(patch.corporateTax)) {
    policy.corporateTax = clamp(
      patch.corporateTax,
      L.corporateTax.min,
      L.corporateTax.max,
    );
  }
  if (patch.interestRate !== undefined && Number.isFinite(patch.interestRate)) {
    policy.interestRate = clamp(
      patch.interestRate,
      L.interestRate.min,
      L.interestRate.max,
    );
  }
  if (patch.spending) {
    for (const key of SPENDING_KEYS) {
      const value = patch.spending[key];
      if (value !== undefined && Number.isFinite(value)) {
        policy.spending[key] = clamp(value, L.spending.min, L.spending.max);
      }
    }
  }
}
