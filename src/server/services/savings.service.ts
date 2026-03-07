import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { savingsTransactionSchema } from "@/src/server/validators/savings";
import { LedgerService } from "@/src/server/services/ledger.service";
import { AuditService } from "@/src/server/services/audit.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { DashboardService } from "@/src/server/services/dashboard.service";

export const SavingsService = {
  async list(input: {
    saccoId: string;
    memberId?: string;
    page: number;
    from?: Date;
    to?: Date;
  }) {
    const pageSize = 30;
    const skip = Math.max(input.page - 1, 0) * pageSize;
    return prisma.savingsTransaction.findMany({
      where: {
        saccoId: input.saccoId,
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
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    });
  },

  async getMemberBalance(saccoId: string, memberId: string) {
    const aggregates = await prisma.savingsTransaction.groupBy({
      by: ["type"],
      where: {
        saccoId,
        memberId,
      },
      _sum: { amount: true },
    });

    const deposit = aggregates.find((item) => item.type === "DEPOSIT")?._sum
      .amount;
    const withdrawal = aggregates.find((item) => item.type === "WITHDRAWAL")
      ?._sum.amount;
    const adjustment = aggregates.find((item) => item.type === "ADJUSTMENT")
      ?._sum.amount;

    return new Prisma.Decimal(deposit ?? 0)
      .minus(new Prisma.Decimal(withdrawal ?? 0))
      .plus(new Prisma.Decimal(adjustment ?? 0));
  },

  async deposit(payload: unknown, actorId?: string) {
    const parsed = savingsTransactionSchema.parse(payload);
    return this.record(
      {
        ...parsed,
        type: "DEPOSIT",
      },
      actorId,
    );
  },

  async withdraw(payload: unknown, actorId?: string) {
    const parsed = savingsTransactionSchema.parse(payload);
    const settings = await SettingsService.get(parsed.saccoId);
    const balance = await this.getMemberBalance(
      parsed.saccoId,
      parsed.memberId,
    );
    const amount = new Prisma.Decimal(parsed.amount);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart);
    monthStart.setDate(1);

    const [dailyWithdrawn, monthlyWithdrawn] = await Promise.all([
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId: parsed.saccoId,
          memberId: parsed.memberId,
          type: "WITHDRAWAL",
          createdAt: { gte: todayStart },
        },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId: parsed.saccoId,
          memberId: parsed.memberId,
          type: "WITHDRAWAL",
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
    ]);

    const dailyTotal = new Prisma.Decimal(dailyWithdrawn._sum.amount ?? 0);
    const monthlyTotal = new Prisma.Decimal(monthlyWithdrawn._sum.amount ?? 0);
    if (
      dailyTotal.plus(amount).greaterThan(settings.savings.dailyWithdrawalLimit)
    ) {
      throw new Error("Daily withdrawal limit exceeded");
    }
    if (
      monthlyTotal
        .plus(amount)
        .greaterThan(settings.savings.monthlyWithdrawalLimit)
    ) {
      throw new Error("Monthly withdrawal limit exceeded");
    }

    if (amount.greaterThan(balance)) {
      throw new Error("Withdrawal amount cannot exceed member savings balance");
    }
    if (balance.minus(amount).lessThan(settings.savings.minimumBalance)) {
      throw new Error("Withdrawal would breach configured minimum balance");
    }

    return this.record(
      {
        ...parsed,
        type: "WITHDRAWAL",
      },
      actorId,
    );
  },

  async record(payload: unknown, actorId?: string) {
    const parsed = savingsTransactionSchema.parse(payload);
    const amount = new Prisma.Decimal(parsed.amount);

    const transaction = await prisma.savingsTransaction.create({
      data: {
        saccoId: parsed.saccoId,
        memberId: parsed.memberId,
        type: parsed.type,
        amount,
        note: parsed.note,
      },
    });

    await LedgerService.record({
      saccoId: parsed.saccoId,
      memberId: parsed.memberId,
      eventType: `SAVINGS_${parsed.type}`,
      amount,
      reference: transaction.id,
    });

    await AuditService.record({
      saccoId: parsed.saccoId,
      actorId,
      action: "CREATE",
      entity: "SavingsTransaction",
      entityId: transaction.id,
      after: transaction,
    });

    DashboardService.invalidateCache(parsed.saccoId);

    return transaction;
  },
};
