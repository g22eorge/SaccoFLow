import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { formatMoney } from "@/src/lib/money";
import { LoanLifecycleService } from "@/src/server/services/loan-lifecycle.service";

const toDecimal = (value: Prisma.Decimal | null | undefined) =>
  value ?? new Prisma.Decimal(0);

const toCurrencyString = (value: Prisma.Decimal | null | undefined) =>
  formatMoney(toDecimal(value).toFixed(2));

export const DashboardService = {
  async monitors(saccoId: string) {
    await LoanLifecycleService.reconcileSacco(saccoId);
    const now = new Date();
    const dayAgo = new Date(now);
    dayAgo.setDate(dayAgo.getDate() - 1);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      memberTotal,
      memberActive,
      loanStatusBuckets,
      outstandingAgg,
      savingsDepositAll,
      savingsWithdrawalAll,
      savingsAdjustmentAll,
      savingsDeposit30,
      savingsWithdrawal30,
      disbursement30,
      repayment30,
      audit24h,
      pendingApprovals,
      recentAudits,
      recentSavings,
      recentRepayments,
    ] = await Promise.all([
      prisma.member.count({ where: { saccoId } }),
      prisma.member.count({ where: { saccoId, status: "ACTIVE" } }),
      prisma.loan.groupBy({
        by: ["status"],
        where: { saccoId },
        _count: { _all: true },
      }),
      prisma.loan.aggregate({
        where: { saccoId, status: { in: ["ACTIVE", "DISBURSED"] } },
        _sum: { outstandingPrincipal: true },
      }),
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
      prisma.savingsTransaction.aggregate({
        where: { saccoId, type: "DEPOSIT", createdAt: { gte: monthAgo } },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: { saccoId, type: "WITHDRAWAL", createdAt: { gte: monthAgo } },
        _sum: { amount: true },
      }),
      prisma.loan.aggregate({
        where: { saccoId, disbursedAt: { gte: monthAgo } },
        _sum: { principalAmount: true },
      }),
      prisma.loanRepayment.aggregate({
        where: { saccoId, paidAt: { gte: monthAgo } },
        _sum: { amount: true },
      }),
      prisma.auditLog.count({
        where: { saccoId, createdAt: { gte: dayAgo } },
      }),
      prisma.loan.count({
        where: { saccoId, status: { in: ["PENDING", "APPROVED"] } },
      }),
      prisma.auditLog.findMany({
        where: { saccoId },
        include: {
          actor: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.savingsTransaction.findMany({
        where: { saccoId },
        include: {
          member: {
            select: {
              fullName: true,
              memberNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.loanRepayment.findMany({
        where: { saccoId },
        include: {
          member: {
            select: {
              fullName: true,
              memberNumber: true,
            },
          },
        },
        orderBy: { paidAt: "desc" },
        take: 3,
      }),
    ]);

    const statusMap = new Map(
      loanStatusBuckets.map((bucket) => [bucket.status, bucket._count._all]),
    );
    const activeLoans = statusMap.get("ACTIVE") ?? 0;
    const disbursedLoans = statusMap.get("DISBURSED") ?? 0;
    const defaultedLoans = statusMap.get("DEFAULTED") ?? 0;
    const clearedLoans = statusMap.get("CLEARED") ?? 0;
    const openLoans = activeLoans + disbursedLoans + defaultedLoans;
    const riskRatio = openLoans === 0 ? 0 : (defaultedLoans / openLoans) * 100;

    const totalSavingsBalance = toDecimal(savingsDepositAll._sum.amount)
      .minus(toDecimal(savingsWithdrawalAll._sum.amount))
      .plus(toDecimal(savingsAdjustmentAll._sum.amount));

    const monthlySavingsNet = toDecimal(savingsDeposit30._sum.amount).minus(
      toDecimal(savingsWithdrawal30._sum.amount),
    );
    const monthlyLoanNet = toDecimal(repayment30._sum.amount).minus(
      toDecimal(disbursement30._sum.principalAmount),
    );

    const recentActivity = [
      ...recentSavings.map((entry) => ({
        id: `savings-${entry.id}`,
        when: entry.createdAt,
        label: `${entry.type} ${formatMoney(entry.amount.toString())} | ${entry.member.memberNumber} ${entry.member.fullName}`,
      })),
      ...recentRepayments.map((entry) => ({
        id: `repayment-${entry.id}`,
        when: entry.paidAt,
        label: `LOAN_REPAYMENT ${formatMoney(entry.amount.toString())} | ${entry.member.memberNumber} ${entry.member.fullName}`,
      })),
      ...recentAudits.map((entry) => ({
        id: `audit-${entry.id}`,
        when: entry.createdAt,
        label: `AUDIT ${entry.action} ${entry.entity} (${entry.actor?.fullName ?? entry.actor?.email ?? "System"})`,
      })),
    ]
      .sort((a, b) => b.when.getTime() - a.when.getTime())
      .slice(0, 8);

    return {
      generatedAt: now,
      kpis: {
        membersTotal: memberTotal,
        membersActive: memberActive,
        loansOpen: openLoans,
        loansCleared: clearedLoans,
        pendingApprovals,
        outstandingPrincipal: toCurrencyString(
          outstandingAgg._sum.outstandingPrincipal,
        ),
        savingsBalance: totalSavingsBalance.toFixed(2),
      },
      monitors: {
        portfolioRiskPercent: Number(riskRatio.toFixed(2)),
        defaultedLoans,
        auditEvents24h: audit24h,
        monthlySavingsNet: monthlySavingsNet.toFixed(2),
        monthlyLoanNet: monthlyLoanNet.toFixed(2),
        monthlyDisbursed: toCurrencyString(disbursement30._sum.principalAmount),
        monthlyRepaid: toCurrencyString(repayment30._sum.amount),
      },
      recentActivity,
    };
  },
};
