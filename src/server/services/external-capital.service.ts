import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import {
  externalCapitalFilterSchema,
  externalCapitalSchema,
  externalCapitalStatusSchema,
} from "@/src/server/validators/external-capital";
import { AuditService } from "@/src/server/services/audit.service";
import { DashboardService } from "@/src/server/services/dashboard.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { ReceiptService } from "@/src/server/services/receipt.service";

const LARGE_INFLOW_THRESHOLD = new Prisma.Decimal(5_000_000);
const toDecimal = (value: Prisma.Decimal | null | undefined) =>
  value ?? new Prisma.Decimal(0);

const isInvestmentAllocation = (allocationBucket?: string | null) =>
  Boolean(allocationBucket && /(INVEST|BOND)/i.test(allocationBucket));

export const ExternalCapitalService = {
  async guardrailsSnapshot(saccoId: string, adjustment = new Prisma.Decimal(0)) {
    const [settings, savingsDeposits, savingsWithdrawals, savingsAdjustments, totalShareCapital, postedExternalAgg, postedInvestmentAgg] =
      await Promise.all([
        SettingsService.get(saccoId),
        prisma.savingsTransaction.aggregate({
          where: { saccoId, type: "DEPOSIT" },
          _sum: { amount: true },
        }),
        prisma.savingsTransaction.aggregate({
          where: { saccoId, type: "WITHDRAWAL" },
          _sum: { amount: true },
        }),
        prisma.savingsTransaction.aggregate({
          where: { saccoId, type: "ADJUSTMENT" },
          _sum: { amount: true },
        }),
        SharesService.getTotalShareCapital(saccoId),
        prisma.externalCapitalTransaction.aggregate({
          where: { saccoId, status: "POSTED" },
          _sum: { baseAmount: true },
        }),
        prisma.externalCapitalTransaction.aggregate({
          where: {
            saccoId,
            status: "POSTED",
            OR: [
              { allocationBucket: { contains: "INVEST" } },
              { allocationBucket: { contains: "BOND" } },
            ],
          },
          _sum: { baseAmount: true },
        }),
      ]);

    const totalSavingsBalance = toDecimal(savingsDeposits._sum.amount)
      .minus(toDecimal(savingsWithdrawals._sum.amount))
      .plus(toDecimal(savingsAdjustments._sum.amount));
    const reserveAmount = totalSavingsBalance
      .mul(settings.savings.liquidityReserveRatioPercent)
      .div(100);
    const totalCapitalBase = totalSavingsBalance
      .plus(toDecimal(totalShareCapital))
      .plus(toDecimal(postedExternalAgg._sum.baseAmount));

    const currentInvestmentAllocated = toDecimal(postedInvestmentAgg._sum.baseAmount);
    const projectedInvestmentAllocated = currentInvestmentAllocated.plus(adjustment);
    const investmentCapAmount = totalCapitalBase
      .mul(settings.savings.maxInvestmentAllocationPercent)
      .div(100);

    const availableLiquidityAfterInvestments = totalSavingsBalance
      .plus(toDecimal(postedExternalAgg._sum.baseAmount))
      .minus(projectedInvestmentAllocated);
    const reserveCoveragePercent = reserveAmount.greaterThan(0)
      ? Number(availableLiquidityAfterInvestments.div(reserveAmount).mul(100).toFixed(2))
      : 999;

    return {
      settings,
      reserveAmount,
      totalCapitalBase,
      currentInvestmentAllocated,
      projectedInvestmentAllocated,
      investmentCapAmount,
      availableLiquidityAfterInvestments,
      reserveCoveragePercent,
    };
  },

  async list(input: {
    saccoId: string;
    page: number;
    type?: string;
    status?: string;
    source?: string;
    from?: Date;
    to?: Date;
  }) {
    const parsed = externalCapitalFilterSchema.parse({
      page: input.page,
      type: input.type,
      status: input.status,
      source: input.source,
      from: input.from,
      to: input.to,
    });

    const pageSize = 30;
    const skip = Math.max(parsed.page - 1, 0) * pageSize;
    return prisma.externalCapitalTransaction.findMany({
      where: {
        saccoId: input.saccoId,
        ...(parsed.type ? { type: parsed.type } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.source ? { source: { contains: parsed.source } } : {}),
        ...(parsed.from || parsed.to
          ? {
              receivedAt: {
                ...(parsed.from ? { gte: parsed.from } : {}),
                ...(parsed.to ? { lte: parsed.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: pageSize,
      skip,
    });
  },

  async total(saccoId: string) {
    const agg = await prisma.externalCapitalTransaction.aggregate({
      where: { saccoId, status: { in: ["RECORDED", "VERIFIED", "POSTED"] } },
      _sum: { baseAmount: true },
    });
    return agg._sum.baseAmount ?? new Prisma.Decimal(0);
  },

  async sourceBreakdown(saccoId: string) {
    const rows = await prisma.externalCapitalTransaction.groupBy({
      by: ["source"],
      where: { saccoId },
      _sum: { baseAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { baseAmount: "desc" } },
      take: 8,
    });
    return rows.map((row) => ({
      source: row.source,
      total: row._sum.baseAmount ?? new Prisma.Decimal(0),
      count: row._count._all,
    }));
  },

  async monthlyTrend(saccoId: string) {
    const rows = await prisma.externalCapitalTransaction.findMany({
      where: {
        saccoId,
        receivedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) },
      },
      select: { receivedAt: true, baseAmount: true },
      orderBy: { receivedAt: "asc" },
    });

    const buckets = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const key = `${row.receivedAt.getUTCFullYear()}-${String(row.receivedAt.getUTCMonth() + 1).padStart(2, "0")}`;
      const current = buckets.get(key) ?? new Prisma.Decimal(0);
      buckets.set(key, current.plus(row.baseAmount));
    }

    return [...buckets.entries()].map(([month, total]) => ({ month, total }));
  },

  async record(payload: unknown, actorId?: string) {
    const parsed = externalCapitalSchema.parse(payload);
    const amount = new Prisma.Decimal(parsed.amount);
    const fxRate = new Prisma.Decimal(parsed.fxRate);
    const baseAmount = amount.mul(fxRate);

    const txn = await prisma.externalCapitalTransaction.create({
      data: {
        saccoId: parsed.saccoId,
        type: parsed.type,
        amount,
        currency: parsed.currency,
        fxRate,
        baseAmount,
        source: parsed.source,
        allocationBucket: parsed.allocationBucket,
        reference: parsed.reference,
        documentUrl: parsed.documentUrl,
        note: parsed.note,
        verificationLevel: parsed.verificationLevel,
        amlFlag: parsed.amlFlag,
        isLargeInflow: baseAmount.greaterThanOrEqualTo(LARGE_INFLOW_THRESHOLD),
        correctionOfId: parsed.correctionOfId,
        correctionReason: parsed.correctionReason,
        receivedAt: parsed.receivedAt ?? new Date(),
      },
    });

    await AuditService.record({
      saccoId: parsed.saccoId,
      actorId,
      action: "CREATE",
      entity: "ExternalCapitalTransaction",
      entityId: txn.id,
      after: txn,
    });

    await ReceiptService.issue({
      saccoId: parsed.saccoId,
      eventType: "EXTERNAL_CAPITAL",
      sourceEntity: "ExternalCapitalTransaction",
      sourceId: txn.id,
      amount: baseAmount,
    });

    DashboardService.invalidateCache(parsed.saccoId);

    return txn;
  },

  async updateStatus(input: {
    saccoId: string;
    id: string;
    actorId: string;
    payload: unknown;
  }) {
    const parsed = externalCapitalStatusSchema.parse(input.payload);
    const existing = await prisma.externalCapitalTransaction.findFirst({
      where: { id: input.id, saccoId: input.saccoId },
    });
    if (!existing) {
      throw new Error("External capital transaction not found");
    }

    if (
      parsed.status === "POSTED" &&
      existing.status !== "POSTED" &&
      isInvestmentAllocation(existing.allocationBucket)
    ) {
      const guardrails = await this.guardrailsSnapshot(
        input.saccoId,
        toDecimal(existing.baseAmount),
      );

      if (
        guardrails.projectedInvestmentAllocated.greaterThan(
          guardrails.investmentCapAmount,
        )
      ) {
        throw new Error(
          `Investment posting blocked: projected investment allocation exceeds cap (${guardrails.settings.savings.maxInvestmentAllocationPercent}%).`,
        );
      }

      if (
        guardrails.reserveCoveragePercent <
        guardrails.settings.savings.minimumReserveCoveragePercent
      ) {
        throw new Error(
          `Investment posting blocked: reserve coverage would fall to ${guardrails.reserveCoveragePercent.toFixed(2)}%, below minimum ${guardrails.settings.savings.minimumReserveCoveragePercent}%.`,
        );
      }
    }

    const updated = await prisma.externalCapitalTransaction.update({
      where: { id: existing.id },
      data: {
        status: parsed.status,
        ...(parsed.amlFlag !== undefined ? { amlFlag: parsed.amlFlag } : {}),
        ...(parsed.verificationLevel !== undefined
          ? { verificationLevel: parsed.verificationLevel }
          : {}),
        ...(parsed.status === "VERIFIED"
          ? { verifiedById: input.actorId, verifiedAt: new Date() }
          : {}),
        ...(parsed.status === "POSTED"
          ? { postedById: input.actorId, postedAt: new Date() }
          : {}),
      },
    });

    await AuditService.record({
      saccoId: input.saccoId,
      actorId: input.actorId,
      action: "UPDATE",
      entity: "ExternalCapitalTransaction",
      entityId: existing.id,
      before: existing,
      after: updated,
    });

    DashboardService.invalidateCache(input.saccoId);

    return updated;
  },

  async correct(input: {
    saccoId: string;
    id: string;
    actorId: string;
    reason: string;
    amount?: number;
  }) {
    const existing = await prisma.externalCapitalTransaction.findFirst({
      where: { id: input.id, saccoId: input.saccoId },
    });
    if (!existing) {
      throw new Error("External capital transaction not found");
    }

    const amount = new Prisma.Decimal(
      input.amount && input.amount > 0
        ? input.amount
        : Number(existing.amount.toString()),
    );

    const correction = await prisma.externalCapitalTransaction.create({
      data: {
        saccoId: input.saccoId,
        type: input.amount ? "ADJUSTMENT" : "REVERSAL",
        amount: input.amount ? amount : amount.negated(),
        currency: existing.currency,
        fxRate: existing.fxRate,
        baseAmount: input.amount
          ? amount.mul(existing.fxRate)
          : amount.mul(existing.fxRate).negated(),
        source: existing.source,
        allocationBucket: existing.allocationBucket,
        reference: existing.reference,
        note: `Correction: ${input.reason}`,
        verificationLevel: existing.verificationLevel,
        amlFlag: existing.amlFlag,
        isLargeInflow: false,
        correctionOfId: existing.id,
        correctionReason: input.reason,
        status: "VERIFIED",
        verifiedById: input.actorId,
        verifiedAt: new Date(),
        receivedAt: new Date(),
      },
    });

    await AuditService.record({
      saccoId: input.saccoId,
      actorId: input.actorId,
      action: "CORRECT",
      entity: "ExternalCapitalTransaction",
      entityId: correction.id,
      before: existing,
      after: correction,
    });

    DashboardService.invalidateCache(input.saccoId);

    return correction;
  },
};
