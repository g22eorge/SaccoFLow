import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";
import { shareTransactionSchema } from "@/src/server/validators/shares";

const PURCHASE_EVENT = "SHARE_PURCHASE";
const REDEMPTION_EVENT = "SHARE_REDEMPTION";
const ADJUSTMENT_EVENT = "SHARE_ADJUSTMENT";
const SHARE_EVENTS = [PURCHASE_EVENT, REDEMPTION_EVENT, ADJUSTMENT_EVENT];

export const SharesService = {
  async list(input: {
    saccoId: string;
    memberId?: string;
    page: number;
    from?: Date;
    to?: Date;
  }) {
    const pageSize = 30;
    const skip = Math.max(input.page - 1, 0) * pageSize;

    return prisma.ledgerEntry.findMany({
      where: {
        saccoId: input.saccoId,
        eventType: { in: SHARE_EVENTS },
        ...(input.memberId ? { memberId: input.memberId } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    });
  },

  async getMemberShareBalance(saccoId: string, memberId: string) {
    const aggregates = await prisma.ledgerEntry.groupBy({
      by: ["eventType"],
      where: {
        saccoId,
        memberId,
        eventType: { in: SHARE_EVENTS },
      },
      _sum: { amount: true },
    });

    const purchases = aggregates.find((item) => item.eventType === PURCHASE_EVENT)?._sum.amount;
    const redemptions = aggregates.find((item) => item.eventType === REDEMPTION_EVENT)?._sum.amount;
    const adjustments = aggregates.find((item) => item.eventType === ADJUSTMENT_EVENT)?._sum.amount;

    return new Prisma.Decimal(purchases ?? 0)
      .minus(new Prisma.Decimal(redemptions ?? 0))
      .plus(new Prisma.Decimal(adjustments ?? 0));
  },

  async getTotalShareCapital(saccoId: string) {
    const aggregates = await prisma.ledgerEntry.groupBy({
      by: ["eventType"],
      where: {
        saccoId,
        eventType: { in: SHARE_EVENTS },
      },
      _sum: { amount: true },
    });

    const purchases = aggregates.find((item) => item.eventType === PURCHASE_EVENT)?._sum.amount;
    const redemptions = aggregates.find((item) => item.eventType === REDEMPTION_EVENT)?._sum.amount;
    const adjustments = aggregates.find((item) => item.eventType === ADJUSTMENT_EVENT)?._sum.amount;

    return new Prisma.Decimal(purchases ?? 0)
      .minus(new Prisma.Decimal(redemptions ?? 0))
      .plus(new Prisma.Decimal(adjustments ?? 0));
  },

  async record(payload: unknown, actorId?: string) {
    const parsed = shareTransactionSchema.parse(payload);
    const amount = new Prisma.Decimal(parsed.amount);

    if (parsed.type === "REDEMPTION") {
      const balance = await this.getMemberShareBalance(parsed.saccoId, parsed.memberId);
      if (amount.greaterThan(balance)) {
        throw new Error("Redemption amount cannot exceed member share balance");
      }
    }

    const eventType =
      parsed.type === "PURCHASE"
        ? PURCHASE_EVENT
        : parsed.type === "REDEMPTION"
          ? REDEMPTION_EVENT
          : ADJUSTMENT_EVENT;

    const transaction = await prisma.ledgerEntry.create({
      data: {
        saccoId: parsed.saccoId,
        memberId: parsed.memberId,
        eventType,
        amount,
        reference: parsed.note,
      },
    });

    await AuditService.record({
      saccoId: parsed.saccoId,
      actorId,
      action: "CREATE",
      entity: "ShareTransaction",
      entityId: transaction.id,
      after: transaction,
    });

    return transaction;
  },
};
