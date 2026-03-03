import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";
import { LoanLifecycleService } from "@/src/server/services/loan-lifecycle.service";

type ReportPeriod = "daily" | "weekly" | "monthly";

const isReportPeriod = (period: string): period is ReportPeriod =>
  period === "daily" || period === "weekly" || period === "monthly";

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getPeriodWindow = (period: ReportPeriod, now = new Date()) => {
  const end = now;
  if (period === "daily") {
    return { start: startOfDay(now), end };
  }

  if (period === "weekly") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const decimalString = (value: Prisma.Decimal | null | undefined) =>
  (value ?? new Prisma.Decimal(0)).toString();

const toDecimal = (value: Prisma.Decimal | null | undefined) =>
  value ?? new Prisma.Decimal(0);

export const ReportsService = {
  async summary(period: string, saccoId: string) {
    if (!isReportPeriod(period)) {
      throw new Error("Unsupported report period");
    }

    await LoanLifecycleService.reconcileSacco(saccoId);

    const { start, end } = getPeriodWindow(period);

    const [
      memberCount,
      memberJoinedCount,
      activeLoans,
      loanAppliedCount,
      disbursedTotal,
      repaymentTotal,
      savingsDepositTotal,
      savingsWithdrawalTotal,
      auditEvents,
    ] = await Promise.all([
      prisma.member.count({ where: { saccoId } }),
      prisma.member.count({
        where: { saccoId, createdAt: { gte: start, lte: end } },
      }),
      prisma.loan.count({
        where: { saccoId, status: { in: ["ACTIVE", "DISBURSED"] } },
      }),
      prisma.loan.count({
        where: { saccoId, appliedAt: { gte: start, lte: end } },
      }),
      prisma.loan.aggregate({
        where: { saccoId, disbursedAt: { gte: start, lte: end } },
        _sum: { principalAmount: true },
      }),
      prisma.loanRepayment.aggregate({
        where: { saccoId, paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId,
          type: "DEPOSIT",
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId,
          type: "WITHDRAWAL",
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.auditLog.count({
        where: { saccoId, createdAt: { gte: start, lte: end } },
      }),
    ]);

    const inflow = toDecimal(savingsDepositTotal._sum.amount).plus(
      toDecimal(repaymentTotal._sum.amount),
    );
    const outflow = toDecimal(savingsWithdrawalTotal._sum.amount).plus(
      toDecimal(disbursedTotal._sum.principalAmount),
    );

    return {
      period,
      window: {
        start,
        end,
      },
      memberCount,
      memberJoinedCount,
      activeLoans,
      loanAppliedCount,
      totals: {
        savingsDeposits: decimalString(savingsDepositTotal._sum.amount),
        savingsWithdrawals: decimalString(savingsWithdrawalTotal._sum.amount),
        loanDisbursements: decimalString(disbursedTotal._sum.principalAmount),
        loanRepayments: decimalString(repaymentTotal._sum.amount),
        netCashFlow: inflow.minus(outflow).toString(),
      },
      auditEvents,
    };
  },

  async memberStatement(input: {
    saccoId: string;
    memberId: string;
    from?: Date;
    to?: Date;
  }) {
    const start = input.from ?? new Date(0);
    const end = input.to ?? new Date();

    const member = await prisma.member.findFirstOrThrow({
      where: { id: input.memberId, saccoId: input.saccoId },
      select: {
        id: true,
        fullName: true,
        memberNumber: true,
      },
    });

    const [savingsTransactions, repayments, appliedLoans, disbursedLoans] =
      await Promise.all([
        prisma.savingsTransaction.findMany({
          where: {
            saccoId: input.saccoId,
            memberId: input.memberId,
            createdAt: { gte: start, lte: end },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.loanRepayment.findMany({
          where: {
            saccoId: input.saccoId,
            memberId: input.memberId,
            paidAt: { gte: start, lte: end },
          },
          orderBy: { paidAt: "desc" },
        }),
        prisma.loan.findMany({
          where: {
            saccoId: input.saccoId,
            memberId: input.memberId,
            appliedAt: { gte: start, lte: end },
          },
          orderBy: { appliedAt: "desc" },
          select: {
            id: true,
            principalAmount: true,
            appliedAt: true,
          },
        }),
        prisma.loan.findMany({
          where: {
            saccoId: input.saccoId,
            memberId: input.memberId,
            disbursedAt: { gte: start, lte: end },
          },
          orderBy: { disbursedAt: "desc" },
          select: {
            id: true,
            principalAmount: true,
            disbursedAt: true,
          },
        }),
      ]);

    const openingSavings = await this.memberSavingsBalance(
      input.saccoId,
      input.memberId,
      start,
      false,
    );
    const closingSavings = await this.memberSavingsBalance(
      input.saccoId,
      input.memberId,
      end,
      true,
    );

    const events = [
      ...savingsTransactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.createdAt,
        type: `SAVINGS_${transaction.type}`,
        amount: transaction.amount.toString(),
        note: transaction.note,
      })),
      ...repayments.map((repayment) => ({
        id: repayment.id,
        date: repayment.paidAt,
        type: "LOAN_REPAYMENT",
        amount: repayment.amount.toString(),
        note: repayment.note,
      })),
      ...appliedLoans.map((loan) => ({
        id: loan.id,
        date: loan.appliedAt,
        type: "LOAN_APPLIED",
        amount: loan.principalAmount.toString(),
        note: null,
      })),
      ...disbursedLoans.map((loan) => ({
        id: loan.id,
        date: loan.disbursedAt as Date,
        type: "LOAN_DISBURSED",
        amount: loan.principalAmount.toString(),
        note: null,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const deposits = savingsTransactions
      .filter((transaction) => transaction.type === "DEPOSIT")
      .reduce(
        (total, transaction) => total.plus(transaction.amount),
        new Prisma.Decimal(0),
      );
    const withdrawals = savingsTransactions
      .filter((transaction) => transaction.type === "WITHDRAWAL")
      .reduce(
        (total, transaction) => total.plus(transaction.amount),
        new Prisma.Decimal(0),
      );
    const repaymentsTotal = repayments.reduce(
      (total, repayment) => total.plus(repayment.amount),
      new Prisma.Decimal(0),
    );

    return {
      member,
      range: { from: start, to: end },
      openingSavings: openingSavings.toString(),
      closingSavings: closingSavings.toString(),
      totals: {
        deposits: deposits.toString(),
        withdrawals: withdrawals.toString(),
        repayments: repaymentsTotal.toString(),
      },
      events,
    };
  },

  async memberStatementCsv(input: {
    saccoId: string;
    memberId: string;
    from?: Date;
    to?: Date;
  }) {
    const statement = await this.memberStatement(input);
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;

    const lines = [
      "memberNumber,memberName,from,to,openingSavings,closingSavings,deposits,withdrawals,repayments",
      [
        statement.member.memberNumber,
        statement.member.fullName,
        statement.range.from.toISOString(),
        statement.range.to.toISOString(),
        statement.openingSavings,
        statement.closingSavings,
        statement.totals.deposits,
        statement.totals.withdrawals,
        statement.totals.repayments,
      ]
        .map((value) => escapeCsv(value))
        .join(","),
      "",
      "date,type,amount,note",
      ...statement.events.map((event) =>
        [event.date.toISOString(), event.type, event.amount, event.note ?? ""]
          .map((value) => escapeCsv(value))
          .join(","),
      ),
    ];

    return lines.join("\n");
  },

  async auditTrail(input: {
    saccoId: string;
    page: number;
    entity?: string;
    actorId?: string;
  }) {
    return AuditService.list(input);
  },

  async memberSavingsBalance(
    saccoId: string,
    memberId: string,
    boundary: Date,
    includeBoundary = true,
  ) {
    const dateFilter = includeBoundary ? { lte: boundary } : { lt: boundary };
    const aggregates = await prisma.savingsTransaction.groupBy({
      by: ["type"],
      where: {
        saccoId,
        memberId,
        createdAt: dateFilter,
      },
      _sum: { amount: true },
    });

    const deposits = toDecimal(
      aggregates.find((item) => item.type === "DEPOSIT")?._sum.amount,
    );
    const withdrawals = toDecimal(
      aggregates.find((item) => item.type === "WITHDRAWAL")?._sum.amount,
    );
    const adjustments = toDecimal(
      aggregates.find((item) => item.type === "ADJUSTMENT")?._sum.amount,
    );
    return deposits.minus(withdrawals).plus(adjustments);
  },
};
