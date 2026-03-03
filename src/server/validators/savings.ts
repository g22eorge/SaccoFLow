import { z } from "zod";

export const savingsTransactionSchema = z.object({
  saccoId: z.string().min(1),
  memberId: z.string().min(1),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "ADJUSTMENT"]),
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});
