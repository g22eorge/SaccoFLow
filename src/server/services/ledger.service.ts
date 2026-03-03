import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";

type LedgerRecordInput = {
  saccoId: string;
  memberId?: string;
  eventType: string;
  amount: Prisma.Decimal;
  reference?: string;
};

export const LedgerService = {
  async record(input: LedgerRecordInput) {
    return prisma.ledgerEntry.create({
      data: {
        saccoId: input.saccoId,
        memberId: input.memberId,
        eventType: input.eventType,
        amount: input.amount,
        reference: input.reference,
      },
    });
  },
};
