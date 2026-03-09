import { z } from "zod";

export const loanApplicationSchema = z.object({
  saccoId: z.string().min(1),
  memberId: z.string().min(1),
  loanProductId: z.string().min(1).optional(),
  principalAmount: z.coerce.number().positive(),
  termMonths: z.coerce.number().int().positive().optional(),
  guarantors: z
    .array(
      z.object({
        guarantorMemberId: z.string().min(1),
        guaranteedAmount: z.coerce.number().positive(),
      }),
    )
    .optional(),
});

export const loanRepaymentSchema = z.object({
  saccoId: z.string().min(1),
  memberId: z.string().min(1),
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});
