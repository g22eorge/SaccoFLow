import { z } from "zod";

export const shareTransactionSchema = z.object({
  saccoId: z.string().min(1),
  memberId: z.string().min(1),
  type: z.enum(["PURCHASE", "REDEMPTION", "ADJUSTMENT"]),
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});
