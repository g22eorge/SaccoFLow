import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";

const DEFAULT_SCOPE = "FINANCIAL";

const formatReceiptCode = (serialNumber: number, issuedAt: Date) =>
  `RCPT-${issuedAt.getUTCFullYear()}-${String(serialNumber).padStart(6, "0")}`;

export const ReceiptService = {
  async issue(input: {
    saccoId: string;
    eventType: string;
    sourceEntity: string;
    sourceId: string;
    amount: Prisma.Decimal | number | string;
  }) {
    const existing = await prisma.receiptVoucher.findUnique({
      where: {
        saccoId_sourceEntity_sourceId: {
          saccoId: input.saccoId,
          sourceEntity: input.sourceEntity,
          sourceId: input.sourceId,
        },
      },
    });
    if (existing) {
      return existing;
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const counter = await tx.receiptCounter.findUnique({
        where: {
          saccoId_scope: {
            saccoId: input.saccoId,
            scope: DEFAULT_SCOPE,
          },
        },
      });

      const serialNumber = counter?.nextNumber ?? 1;
      if (counter) {
        await tx.receiptCounter.update({
          where: { id: counter.id },
          data: { nextNumber: { increment: 1 } },
        });
      } else {
        await tx.receiptCounter.create({
          data: {
            saccoId: input.saccoId,
            scope: DEFAULT_SCOPE,
            nextNumber: 2,
          },
        });
      }

      return tx.receiptVoucher.create({
        data: {
          saccoId: input.saccoId,
          serialNumber,
          receiptCode: formatReceiptCode(serialNumber, now),
          eventType: input.eventType,
          sourceEntity: input.sourceEntity,
          sourceId: input.sourceId,
          amount: new Prisma.Decimal(input.amount),
          status: "ISSUED",
          issuedAt: now,
        },
      });
    });
  },

  async getById(saccoId: string, id: string) {
    return prisma.receiptVoucher.findFirst({ where: { id, saccoId } });
  },

  async void(input: {
    saccoId: string;
    id: string;
    reason: string;
  }) {
    const existing = await prisma.receiptVoucher.findFirst({
      where: { id: input.id, saccoId: input.saccoId },
    });
    if (!existing) {
      throw new Error("Receipt not found");
    }
    if (existing.status === "VOIDED") {
      return existing;
    }

    return prisma.receiptVoucher.update({
      where: { id: existing.id },
      data: {
        status: "VOIDED",
        voidReason: input.reason,
        voidedAt: new Date(),
      },
    });
  },

  async reissue(input: {
    saccoId: string;
    id: string;
  }) {
    const existing = await prisma.receiptVoucher.findFirst({
      where: { id: input.id, saccoId: input.saccoId },
    });
    if (!existing) {
      throw new Error("Receipt not found");
    }
    if (existing.status !== "VOIDED") {
      throw new Error("Only voided receipts can be reissued");
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const counter = await tx.receiptCounter.findUnique({
        where: {
          saccoId_scope: {
            saccoId: input.saccoId,
            scope: DEFAULT_SCOPE,
          },
        },
      });
      const serialNumber = counter?.nextNumber ?? 1;
      if (counter) {
        await tx.receiptCounter.update({
          where: { id: counter.id },
          data: { nextNumber: { increment: 1 } },
        });
      } else {
        await tx.receiptCounter.create({
          data: {
            saccoId: input.saccoId,
            scope: DEFAULT_SCOPE,
            nextNumber: 2,
          },
        });
      }

      return tx.receiptVoucher.create({
        data: {
          saccoId: input.saccoId,
          serialNumber,
          receiptCode: formatReceiptCode(serialNumber, now),
          eventType: existing.eventType,
          sourceEntity: "REISSUE",
          sourceId: existing.id,
          amount: existing.amount,
          status: "ISSUED",
          issuedAt: now,
          reissuedFromId: existing.id,
        },
      });
    });
  },
};
