import { z } from "zod";

export const externalCapitalSchema = z.object({
  saccoId: z.string().min(1),
  type: z
    .enum(["DONATION", "GRANT", "EXTERNAL_FUNDING", "ADJUSTMENT", "REVERSAL", "OTHER"])
    .default("DONATION"),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(10).optional().default("UGX"),
  fxRate: z.coerce.number().positive().optional().default(1),
  source: z.string().min(2).max(160),
  allocationBucket: z.string().max(80).optional(),
  reference: z.string().max(120).optional(),
  documentUrl: z.string().url().max(600).optional(),
  note: z.string().max(400).optional(),
  verificationLevel: z.enum(["BASIC", "ENHANCED", "STRICT"]).optional().default("BASIC"),
  amlFlag: z.coerce.boolean().optional().default(false),
  receivedAt: z.coerce.date().optional(),
  correctionOfId: z.string().optional(),
  correctionReason: z.string().max(300).optional(),
});

export const externalCapitalStatusSchema = z.object({
  status: z.enum(["RECORDED", "VERIFIED", "POSTED"]),
  amlFlag: z.coerce.boolean().optional(),
  verificationLevel: z.enum(["BASIC", "ENHANCED", "STRICT"]).optional(),
});

export const externalCapitalFilterSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  type: z
    .enum(["DONATION", "GRANT", "EXTERNAL_FUNDING", "ADJUSTMENT", "REVERSAL", "OTHER"])
    .optional(),
  status: z.enum(["RECORDED", "VERIFIED", "POSTED"]).optional(),
  source: z.string().max(160).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
