import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { formatMoney } from "@/src/lib/money";
import { LoanLifecycleService } from "@/src/server/services/loan-lifecycle.service";
import { SharesService } from "@/src/server/services/shares.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";

type DashboardMonitorsResult = {
  generatedAt: Date;
  kpis: {
    membersTotal: number;
    membersActive: number;
    loansOpen: number;
    loansCleared: number;
    pendingApprovals: number;
    pendingLoanRequests: number;
    pendingMemberRequests: number;
    externalCapital: string;
    outstandingPrincipal: string;
    savingsBalance: string;
    totalShareCapital: string;
    lendableFunds: string;
    capitalSupportedCapacity: string;
    totalLendingHeadroom: string;
  };
  monitors: {
    portfolioRiskPercent: number;
    defaultedLoans: number;
    auditEvents24h: number;
    monthlySavingsNet: string;
    monthlyLoanNet: string;
    monthlyDisbursed: string;
    monthlyRepaid: string;
    pendingDisbursements: string;
    liquidityReserveAmount: string;
    liquidityReserveRatioPercent: number;
    deployableShareCapital: string;
    deployableExternalCapital: string;
    deployableShareCapitalRatioPercent: number;
    par30Percent: number;
    par90Percent: number;
    concentrationTop5Percent: number;
    liquidityCoveragePercent: number;
    recoveryRate30d: number;
  };
  recentActivity: Array<{
    id: string;
    when: Date;
    label: string;
  }>;
};

const DASHBOARD_CACHE_TTL_MS = 20_000;
const dashboardMonitorsCache = new Map<
  string,
  {
    expiresAt: number;
    value: DashboardMonitorsResult;
  }
>();

const toDecimal = (value: Prisma.Decimal | null | undefined) =>
  value ?? new Prisma.Decimal(0);

const toCurrencyString = (value: Prisma.Decimal | null | undefined) =>
  formatMoney(toDecimal(value).toFixed(2));

export const DashboardService = {
  invalidateCache(saccoId: string) {
    dashboardMonitorsCache.delete(saccoId);
  },

  async monitors(saccoId: string) {
    const cached = dashboardMonitorsCache.get(saccoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    await LoanLifecycleService.reconcileSacco(saccoId);
    const now = new Date();
    const dayAgo = new Date(now);
    dayAgo.setDate(dayAgo.getDate() - 1);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      settings,
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
      pendingLoanRequests,
      recentAudits,
      recentSavings,
      recentRepayments,
      totalShareCapital,
      pendingDisbursementAgg,
      memberRequestLogs,
      outstandingExposureAgg,
      par30ExposureAgg,
      par90ExposureAgg,
      memberExposureBuckets,
      externalCapital,
      postedExternalCapitalAgg,
    ] = await Promise.all([
      SettingsService.get(saccoId),
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
      prisma.loan.count({
        where: { saccoId, status: "PENDING" },
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
      SharesService.getTotalShareCapital(saccoId),
      prisma.loan.aggregate({
        where: { saccoId, status: "APPROVED" },
        _sum: { principalAmount: true },
      }),
      prisma.auditLog.findMany({
        where: {
          saccoId,
          entity: "MemberRequest",
        },
        select: {
          afterJson: true,
        },
      }),
      prisma.loan.aggregate({
        where: { saccoId, status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] } },
        _sum: {
          outstandingPrincipal: true,
          outstandingInterest: true,
          outstandingPenalty: true,
        },
      }),
      prisma.loan.aggregate({
        where: {
          saccoId,
          status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] },
          dueAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        _sum: {
          outstandingPrincipal: true,
          outstandingInterest: true,
          outstandingPenalty: true,
        },
      }),
      prisma.loan.aggregate({
        where: {
          saccoId,
          status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] },
          dueAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
        _sum: {
          outstandingPrincipal: true,
          outstandingInterest: true,
          outstandingPenalty: true,
        },
      }),
      prisma.loan.groupBy({
        by: ["memberId"],
        where: {
          saccoId,
          status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] },
        },
        _sum: {
          outstandingPrincipal: true,
          outstandingInterest: true,
          outstandingPenalty: true,
        },
      }),
      ExternalCapitalService.total(saccoId),
      prisma.externalCapitalTransaction.aggregate({
        where: { saccoId, status: "POSTED" },
        _sum: { baseAmount: true },
      }),
    ]);

    const pendingMemberRequests = memberRequestLogs.reduce((count, log) => {
      if (!log.afterJson) {
        return count;
      }

      try {
        const payload = JSON.parse(log.afterJson) as { status?: unknown };
        return payload.status === "PENDING" ? count + 1 : count;
      } catch {
        return count;
      }
    }, 0);

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

    const liquidityReserveAmount = totalSavingsBalance
      .mul(settings.savings.liquidityReserveRatioPercent)
      .div(100);
    const pendingDisbursementAmount = toDecimal(
      pendingDisbursementAgg._sum.principalAmount,
    );

    const totalOutstandingExposure = toDecimal(
      outstandingExposureAgg._sum.outstandingPrincipal,
    )
      .plus(toDecimal(outstandingExposureAgg._sum.outstandingInterest))
      .plus(toDecimal(outstandingExposureAgg._sum.outstandingPenalty));

    const par30Exposure = toDecimal(par30ExposureAgg._sum.outstandingPrincipal)
      .plus(toDecimal(par30ExposureAgg._sum.outstandingInterest))
      .plus(toDecimal(par30ExposureAgg._sum.outstandingPenalty));

    const par90Exposure = toDecimal(par90ExposureAgg._sum.outstandingPrincipal)
      .plus(toDecimal(par90ExposureAgg._sum.outstandingInterest))
      .plus(toDecimal(par90ExposureAgg._sum.outstandingPenalty));

    const top5Exposure = memberExposureBuckets
      .map((bucket) =>
        toDecimal(bucket._sum.outstandingPrincipal)
          .plus(toDecimal(bucket._sum.outstandingInterest))
          .plus(toDecimal(bucket._sum.outstandingPenalty)),
      )
      .sort((a, b) => Number(b.minus(a)))
      .slice(0, 5)
      .reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));

    const par30Percent = totalOutstandingExposure.greaterThan(0)
      ? Number(par30Exposure.div(totalOutstandingExposure).mul(100).toFixed(2))
      : 0;
    const par90Percent = totalOutstandingExposure.greaterThan(0)
      ? Number(par90Exposure.div(totalOutstandingExposure).mul(100).toFixed(2))
      : 0;
    const concentrationTop5Percent = totalOutstandingExposure.greaterThan(0)
      ? Number(top5Exposure.div(totalOutstandingExposure).mul(100).toFixed(2))
      : 0;
    const recoveryRate30d = toDecimal(disbursement30._sum.principalAmount).greaterThan(0)
      ? Number(toDecimal(repayment30._sum.amount).div(toDecimal(disbursement30._sum.principalAmount)).mul(100).toFixed(2))
      : 0;
    const liquidityLendableFunds = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      totalSavingsBalance.minus(liquidityReserveAmount).minus(pendingDisbursementAmount),
    );
    const liquidityCoveragePercent = pendingDisbursementAmount.greaterThan(0)
      ? Number(liquidityLendableFunds.div(pendingDisbursementAmount).mul(100).toFixed(2))
      : 999;
    const deployableShareCapital = toDecimal(totalShareCapital)
      .mul(settings.savings.deployableShareCapitalRatioPercent)
      .div(100);
    const deployableExternalCapital = toDecimal(
      postedExternalCapitalAgg._sum.baseAmount,
    );
    const liquidityLendableFundsWithExternalCapital = liquidityLendableFunds.plus(
      deployableExternalCapital,
    );
    const capitalSupportedCapacityWithExternalCapital =
      liquidityLendableFundsWithExternalCapital.plus(deployableShareCapital);

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

    const result: DashboardMonitorsResult = {
      generatedAt: now,
      kpis: {
        membersTotal: memberTotal,
        membersActive: memberActive,
        loansOpen: openLoans,
        loansCleared: clearedLoans,
        pendingApprovals,
        pendingLoanRequests,
        pendingMemberRequests,
        externalCapital: formatMoney(externalCapital.toFixed(2)),
        outstandingPrincipal: toCurrencyString(
          outstandingAgg._sum.outstandingPrincipal,
        ),
        savingsBalance: formatMoney(totalSavingsBalance.toFixed(2)),
        totalShareCapital: formatMoney(totalShareCapital.toFixed(2)),
        lendableFunds: formatMoney(
          liquidityLendableFundsWithExternalCapital.toFixed(2),
        ),
        capitalSupportedCapacity: formatMoney(
          capitalSupportedCapacityWithExternalCapital.toFixed(2),
        ),
        totalLendingHeadroom: formatMoney(
          capitalSupportedCapacityWithExternalCapital.toFixed(2),
        ),
      },
      monitors: {
        portfolioRiskPercent: Number(riskRatio.toFixed(2)),
        defaultedLoans,
        auditEvents24h: audit24h,
        monthlySavingsNet: monthlySavingsNet.toFixed(2),
        monthlyLoanNet: monthlyLoanNet.toFixed(2),
        monthlyDisbursed: toCurrencyString(disbursement30._sum.principalAmount),
        monthlyRepaid: toCurrencyString(repayment30._sum.amount),
        pendingDisbursements: formatMoney(pendingDisbursementAmount.toFixed(2)),
        liquidityReserveAmount: formatMoney(liquidityReserveAmount.toFixed(2)),
        liquidityReserveRatioPercent: settings.savings.liquidityReserveRatioPercent,
        deployableShareCapital: formatMoney(deployableShareCapital.toFixed(2)),
        deployableExternalCapital: formatMoney(deployableExternalCapital.toFixed(2)),
        deployableShareCapitalRatioPercent:
          settings.savings.deployableShareCapitalRatioPercent,
        par30Percent,
        par90Percent,
        concentrationTop5Percent,
        liquidityCoveragePercent,
        recoveryRate30d,
      },
      recentActivity,
    };

    dashboardMonitorsCache.set(saccoId, {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
      value: result,
    });

    return result;
  },
};
