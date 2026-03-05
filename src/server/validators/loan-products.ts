import { z } from "zod";

export const loanProductUpsertSchema = z.object({
  name: z.string().min(2).max(120),
  minPrincipal: z.coerce.number().nonnegative(),
  maxPrincipal: z.coerce.number().positive(),
  minTermMonths: z.coerce.number().int().positive(),
  maxTermMonths: z.coerce.number().int().positive(),
  repaymentFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  requireGuarantor: z.coerce.boolean().optional().default(false),
  requireCollateral: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
  isDefault: z.coerce.boolean().optional().default(false),
});
