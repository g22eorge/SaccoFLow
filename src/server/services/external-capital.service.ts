import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import {
  externalCapitalFilterSchema,
  externalCapitalSchema,
  externalCapitalStatusSchema,
} from "@/src/server/validators/external-capital";
import { AuditService } from "@/src/server/services/audit.service";

const LARGE_INFLOW_THRESHOLD = new Prisma.Decimal(5_000_000);

export const ExternalCapitalService = {
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

    return correction;
  },
};
