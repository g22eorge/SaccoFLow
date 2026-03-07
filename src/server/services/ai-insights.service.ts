/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { DashboardService } from "@/src/server/services/dashboard.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { formatMemberLabel } from "@/src/lib/member-label";

type AnyRow = Record<string, any>;

const DAY_MS = 24 * 60 * 60 * 1000;

const decimal = (value: Prisma.Decimal | null | undefined) =>
  new Prisma.Decimal(value ?? 0);

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const toMemberLabel = (member: { memberNumber?: string | null; fullName?: string | null }) =>
  formatMemberLabel(member.memberNumber ?? "", member.fullName ?? "Unknown Member");

type PolicyInput = {
  greenMinScore: number;
  creditCapacityMultiplier: number;
  minRepaymentCount: number;
  utilizationWarningThreshold: number;
  utilizationHardStopThreshold: number;
};

const evaluatePolicy = (input: {
  principal: Prisma.Decimal;
  collateralBase: Prisma.Decimal;
  defaultedCount: number;
  repaymentCount: number;
  policy: PolicyInput;
}) => {
  const maxSupported = input.collateralBase.mul(input.policy.creditCapacityMultiplier);
  const utilization = maxSupported.greaterThan(0)
    ? Number(input.principal.div(maxSupported).toFixed(4))
    : Number.POSITIVE_INFINITY;

  let score = 100;
  score -= input.defaultedCount > 0 ? 30 : 0;
  score -= input.repaymentCount < input.policy.minRepaymentCount ? 12 : 0;
  if (utilization > input.policy.utilizationHardStopThreshold) {
    score -= 25;
  } else if (utilization > input.policy.utilizationWarningThreshold) {
    score -= 10;
  }

  const finalScore = clamp(score);
  return {
    score: finalScore,
    autoEligible:
      finalScore >= input.policy.greenMinScore &&
      input.defaultedCount === 0 &&
      input.repaymentCount >= input.policy.minRepaymentCount &&
      utilization <= input.policy.utilizationHardStopThreshold,
  };
};

export const AiInsightsService = {
  async getOverview(saccoId: string) {
    const now = new Date();
    const settings = await SettingsService.get(saccoId);

    const [
      pendingLoans,
      activeLoans,
      loanRepaymentMax,
      collectionActions,
      suspiciousSavings,
      memberLoansRecent,
      approvedLoans,
      matrixStates,
      externalCapital,
      dashboard,
    ] = await Promise.all([
      prisma.loan.findMany({
        where: { saccoId, status: "PENDING" },
        include: {
          member: {
            select: { id: true, memberNumber: true, fullName: true, phone: true, email: true },
          },
        },
        orderBy: { appliedAt: "desc" },
        take: 20,
      }),
      prisma.loan.findMany({
        where: { saccoId, status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] } },
        include: { member: { select: { id: true, memberNumber: true, fullName: true, phone: true, email: true } } },
        orderBy: { dueAt: "asc" },
        take: 120,
      }),
      prisma.loanRepayment.groupBy({
        by: ["loanId"],
        where: { saccoId },
        _max: { paidAt: true },
        _count: { _all: true },
      }),
      prisma.auditLog.findMany({
        where: { saccoId, entity: "CollectionAction" },
        select: { afterJson: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.savingsTransaction.findMany({
        where: {
          saccoId,
          type: "ADJUSTMENT",
          amount: { gte: new Prisma.Decimal(1_000_000) },
          createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
        },
        include: { member: { select: { fullName: true, memberNumber: true } } },
        orderBy: { amount: "desc" },
        take: 10,
      }),
      prisma.loan.groupBy({
        by: ["memberId"],
        where: { saccoId, appliedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
        _count: { _all: true },
      }),
      prisma.loan.findMany({
        where: { saccoId, status: "APPROVED" },
        select: { id: true, memberId: true, principalAmount: true, appliedAt: true },
        take: 100,
      }),
      prisma.auditLog.findMany({
        where: { saccoId, entity: "LoanApprovalMatrixState" },
        select: { entityId: true },
      }),
      prisma.externalCapitalTransaction.findMany({
        where: { saccoId },
        select: {
          id: true,
          source: true,
          baseAmount: true,
          isLargeInflow: true,
          amlFlag: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: "desc" },
        take: 300,
      }),
      DashboardService.monitors(saccoId),
    ]);

    const repaymentByLoan = new Map<string, { count: number; lastPaidAt: Date | null }>(
      (loanRepaymentMax as AnyRow[]).map((item: AnyRow) => [
        item.loanId,
        {
          count: item._count._all,
          lastPaidAt: item._max.paidAt,
        },
      ]),
    );

    const memberStats = new Map<string, { defaultedCount: number; repaymentCount: number; collateral: Prisma.Decimal }>();
    for (const loan of [...(pendingLoans as AnyRow[]), ...(activeLoans as AnyRow[])]) {
      const current = memberStats.get(loan.memberId) ?? {
        defaultedCount: 0,
        repaymentCount: 0,
        collateral: new Prisma.Decimal(0),
      };
      if (loan.status === "DEFAULTED") {
        current.defaultedCount += 1;
      }
      const repayment = repaymentByLoan.get(loan.id);
      current.repaymentCount += repayment?.count ?? 0;
      current.collateral = current.collateral.plus(decimal(loan.principalAmount).mul(0.25));
      memberStats.set(loan.memberId, current);
    }

    const creditRecommendations = (pendingLoans as AnyRow[]).map((loan: AnyRow) => {
      const stats = memberStats.get(loan.memberId) ?? {
        defaultedCount: 0,
        repaymentCount: 0,
        collateral: new Prisma.Decimal(0),
      };
      const evaluation = evaluatePolicy({
        principal: decimal(loan.principalAmount),
        collateralBase: stats.collateral,
        defaultedCount: stats.defaultedCount,
        repaymentCount: stats.repaymentCount,
        policy: {
          greenMinScore: settings.autoDecision.greenMinScore,
          creditCapacityMultiplier: settings.autoDecision.creditCapacityMultiplier,
          minRepaymentCount: settings.autoDecision.minRepaymentCount,
          utilizationWarningThreshold: settings.autoDecision.utilizationWarningThreshold,
          utilizationHardStopThreshold: settings.autoDecision.utilizationHardStopThreshold,
        },
      });
      const recommendation =
        evaluation.score >= settings.autoDecision.greenMinScore
          ? "APPROVE_FAST_TRACK"
          : evaluation.score >= settings.autoDecision.greenMinScore - 15
            ? "REVIEW_MANUAL"
            : "DECLINE_OR_REWORK";

      const reasonCodes = [
        stats.defaultedCount > 0 ? "HAS_DEFAULT_HISTORY" : "NO_DEFAULT_HISTORY",
        stats.repaymentCount >= settings.autoDecision.minRepaymentCount
          ? "SUFFICIENT_REPAYMENT_HISTORY"
          : "THIN_REPAYMENT_HISTORY",
      ];

      return {
        loanId: loan.id,
        memberName: toMemberLabel(loan.member),
        score: evaluation.score,
        confidence: clamp(Math.round((evaluation.score / 100) * 92 + 8)),
        recommendation,
        reasonCodes,
      };
    });

    const earlyDelinquency = (activeLoans as AnyRow[])
      .map((loan: AnyRow) => {
        const dueAt = loan.dueAt ? new Date(loan.dueAt) : null;
        const daysToDue = dueAt ? Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS) : null;
        const repayment = repaymentByLoan.get(loan.id);
        const daysSinceLastRepayment = repayment?.lastPaidAt
          ? Math.floor((now.getTime() - new Date(repayment.lastPaidAt).getTime()) / DAY_MS)
          : 999;

        let risk: "HIGH" | "MEDIUM" | "WATCH" | null = null;
        if (daysToDue !== null && daysToDue < 0) {
          risk = "HIGH";
        } else if (daysToDue !== null && daysToDue <= 14 && daysSinceLastRepayment > 30) {
          risk = "MEDIUM";
        } else if (daysToDue !== null && daysToDue <= 30) {
          risk = "WATCH";
        }

        if (!risk) {
          return null;
        }

        return {
          loanId: loan.id,
          memberName: toMemberLabel(loan.member),
          risk,
          daysToDue,
          daysSinceLastRepayment,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, 20);

    const collectionActionByLoan = new Map<string, { actionType: string; createdAt: string }>();
    for (const entry of collectionActions) {
      if (!entry.afterJson) {
        continue;
      }
      try {
        const payload = JSON.parse(entry.afterJson) as { loanId?: string; actionType?: string };
        if (!payload.loanId || collectionActionByLoan.has(payload.loanId)) {
          continue;
        }
        collectionActionByLoan.set(payload.loanId, {
          actionType: payload.actionType ?? "CALL",
          createdAt: entry.createdAt.toISOString(),
        });
      } catch {
        continue;
      }
    }

    const nextBestActions = earlyDelinquency.map((row: AnyRow) => {
      const channel = row.risk === "HIGH" ? "VISIT+CALL" : row.risk === "MEDIUM" ? "CALL" : "SMS";
      const timing = row.risk === "HIGH" ? "within 24h" : row.risk === "MEDIUM" ? "within 72h" : "within 7 days";
      const script =
        row.risk === "HIGH"
          ? "Discuss arrears immediately and secure concrete commitment with date."
          : row.risk === "MEDIUM"
            ? "Confirm repayment intent and remind due obligations."
            : "Friendly reminder of due schedule and available support.";
      return {
        ...row,
        channel,
        timing,
        script,
        lastAction: collectionActionByLoan.get(row.loanId) ?? null,
      };
    });

    const rapidLoanMembers = (memberLoansRecent as AnyRow[])
      .filter((bucket: AnyRow) => bucket._count._all >= 3)
      .map((bucket: AnyRow) => ({ memberId: bucket.memberId, applications7d: bucket._count._all }));
    const matrixSet = new Set((matrixStates as AnyRow[]).map((entry: AnyRow) => entry.entityId));
    const potentialApprovalBypass = (approvedLoans as AnyRow[])
      .filter((loan: AnyRow) => !matrixSet.has(loan.id))
      .slice(0, 10)
      .map((loan: AnyRow) => ({
        loanId: loan.id,
        memberId: loan.memberId,
        principalAmount: loan.principalAmount.toString(),
      }));

    const anomalyAlerts = {
      highValueAdjustments: (suspiciousSavings as AnyRow[]).map((row: AnyRow) => ({
        id: row.id,
        memberName: toMemberLabel(row.member),
        memberNumber: row.member.memberNumber,
        amount: row.amount.toString(),
        createdAt: row.createdAt.toISOString(),
      })),
      rapidLoanApplications: rapidLoanMembers,
      possibleApprovalBypass: potentialApprovalBypass,
      flaggedExternalCapital: (externalCapital as AnyRow[])
        .filter((row: AnyRow) => row.amlFlag || row.isLargeInflow)
        .slice(0, 12)
        .map((row: AnyRow) => ({
          id: row.id,
          source: row.source,
          baseAmount: row.baseAmount.toString(),
          amlFlag: row.amlFlag,
          isLargeInflow: row.isLargeInflow,
        })),
    };

    const donorBySource = new Map<string, { total: Prisma.Decimal; count: number }>();
    for (const row of externalCapital as AnyRow[]) {
      const current = donorBySource.get(row.source) ?? {
        total: new Prisma.Decimal(0),
        count: 0,
      };
      donorBySource.set(row.source, {
        total: current.total.plus(row.baseAmount),
        count: current.count + 1,
      });
    }
    const repeatDonors = [...donorBySource.entries()]
      .filter(([, value]) => value.count > 1)
      .map(([source, value]) => ({ source, count: value.count, total: value.total.toString() }))
      .sort((a, b) => Number(new Prisma.Decimal(b.total).minus(a.total)))
      .slice(0, 8);

    const monthBucket = new Map<string, Prisma.Decimal>();
    for (const row of externalCapital as AnyRow[]) {
      const key = `${row.receivedAt.getUTCFullYear()}-${String(row.receivedAt.getUTCMonth() + 1).padStart(2, "0")}`;
      monthBucket.set(key, (monthBucket.get(key) ?? new Prisma.Decimal(0)).plus(row.baseAmount));
    }
    const monthlyTotals = [...monthBucket.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total: total.toString() }));
    const forecastNextMonth =
      monthlyTotals.length === 0
        ? "0"
        : new Prisma.Decimal(
            monthlyTotals
              .slice(-3)
              .reduce((sum, row) => sum.plus(new Prisma.Decimal(row.total)), new Prisma.Decimal(0))
              .div(Math.min(3, monthlyTotals.length))
              .toFixed(2),
          ).toString();

    const latestSavings = await prisma.savingsTransaction.findMany({
      where: { saccoId },
      select: { id: true, amount: true, type: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    const refs = latestSavings.map((row: AnyRow) => row.id);
    const matchingLedger = refs.length
      ? await prisma.ledgerEntry.findMany({
          where: {
            saccoId,
            reference: { in: refs },
            eventType: { in: ["SAVINGS_DEPOSIT", "SAVINGS_WITHDRAWAL", "SAVINGS_ADJUSTMENT"] },
          },
          select: { reference: true },
        })
      : [];
    const matchedSet = new Set((matchingLedger as AnyRow[]).map((row: AnyRow) => row.reference));
    const missingLedger = (latestSavings as AnyRow[]).filter((row: AnyRow) => !matchedSet.has(row.id));

    const smartReconciliation = {
      sampledSavingsTransactions: latestSavings.length,
      missingLedgerEntries: missingLedger.length,
      missingLedgerAmount: missingLedger
        .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
        .toString(),
      proposal:
        missingLedger.length > 0
          ? "Create missing savings ledger entries from transaction ids in reference field."
          : "No reconciliation exception detected in latest sample.",
    };

    const memberNudges = (activeLoans as AnyRow[])
      .map((loan: AnyRow) => {
        if (!loan.dueAt) {
          return null;
        }
        const daysToDue = Math.ceil((loan.dueAt.getTime() - now.getTime()) / DAY_MS);
        if (daysToDue > 14 || daysToDue < -5) {
          return null;
        }
        const preferredChannel = loan.member.phone
          ? "SMS"
          : loan.member.email
            ? "EMAIL"
            : "CALL";
        const timing = daysToDue <= 3 ? "today 09:00" : "in 48 hours";
        return {
          loanId: loan.id,
          memberName: toMemberLabel(loan.member),
          daysToDue,
          preferredChannel,
          timing,
          message:
            daysToDue <= 3
              ? "Your installment is due soon. Please top up before due date to avoid penalties."
              : "Friendly reminder: your next installment is approaching. Plan repayment early.",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, 20);

    const executiveBrief = [
      `Portfolio risk is ${dashboard.monitors.portfolioRiskPercent.toFixed(2)}% with PAR30 at ${dashboard.monitors.par30Percent.toFixed(1)}%.`,
      `Pending approvals stand at ${dashboard.kpis.pendingApprovals} and collections high-risk cases at ${nextBestActions.filter((row: any) => row.risk === "HIGH").length}.`,
      `External capital currently totals ${dashboard.kpis.externalCapital} with projected next-month inflow around ${forecastNextMonth}.`,
      `Reconciliation exceptions found: ${smartReconciliation.missingLedgerEntries} missing ledger entries in sampled savings transactions.`,
    ].join(" ");

    return {
      generatedAt: now.toISOString(),
      creditDecisionAssistant: creditRecommendations,
      earlyDelinquencyPrediction: earlyDelinquency,
      collectionsNextBestAction: nextBestActions,
      approvalCopilot: creditRecommendations.map((row) => ({
        loanId: row.loanId,
        summary: `${row.recommendation} at confidence ${row.confidence}%`,
        riskScore: row.score,
        missingEvidence:
          row.reasonCodes.includes("THIN_REPAYMENT_HISTORY")
            ? ["Repayment history", "Income support docs"]
            : [],
      })),
      anomalyFraudDetection: anomalyAlerts,
      donorIntelligence: {
        repeatDonors,
        monthlyTotals,
        forecastNextMonth,
      },
      smartReconciliation,
      executiveBrief,
      memberNudgingEngine: memberNudges,
    };
  },

  async simulatePolicy(input: {
    saccoId: string;
    overrides: Partial<PolicyInput>;
  }) {
    const settings = await SettingsService.get(input.saccoId);
    const policy: PolicyInput = {
      greenMinScore:
        input.overrides.greenMinScore ?? settings.autoDecision.greenMinScore,
      creditCapacityMultiplier:
        input.overrides.creditCapacityMultiplier ??
        settings.autoDecision.creditCapacityMultiplier,
      minRepaymentCount:
        input.overrides.minRepaymentCount ?? settings.autoDecision.minRepaymentCount,
      utilizationWarningThreshold:
        input.overrides.utilizationWarningThreshold ??
        settings.autoDecision.utilizationWarningThreshold,
      utilizationHardStopThreshold:
        input.overrides.utilizationHardStopThreshold ??
        settings.autoDecision.utilizationHardStopThreshold,
    };

    const pendingLoans = await prisma.loan.findMany({
      where: { saccoId: input.saccoId, status: "PENDING" },
      select: { id: true, memberId: true, principalAmount: true },
      take: 120,
    });

    const loanByMember = await prisma.loan.groupBy({
      by: ["memberId", "status"],
      where: {
        saccoId: input.saccoId,
        memberId: { in: pendingLoans.map((row) => row.memberId) },
      },
      _count: { _all: true },
      _sum: { principalAmount: true },
    });

    const grouped = new Map<string, { defaultedCount: number; repaymentCount: number; collateral: Prisma.Decimal }>();
    for (const row of loanByMember as AnyRow[]) {
      const current = grouped.get(row.memberId) ?? {
        defaultedCount: 0,
        repaymentCount: 0,
        collateral: new Prisma.Decimal(0),
      };
      if (row.status === "DEFAULTED") {
        current.defaultedCount += row._count._all;
      }
      current.repaymentCount += row._count._all;
      current.collateral = current.collateral.plus(decimal(row._sum.principalAmount).mul(0.2));
      grouped.set(row.memberId, current);
    }

    let eligible = 0;
    let totalScore = 0;
    for (const loan of pendingLoans as AnyRow[]) {
      const stats = grouped.get(loan.memberId) ?? {
        defaultedCount: 0,
        repaymentCount: 0,
        collateral: new Prisma.Decimal(0),
      };
      const result = evaluatePolicy({
        principal: loan.principalAmount,
        collateralBase: stats.collateral,
        defaultedCount: stats.defaultedCount,
        repaymentCount: stats.repaymentCount,
        policy,
      });
      totalScore += result.score;
      if (result.autoEligible) {
        eligible += 1;
      }
    }

    return {
      totalPendingLoans: pendingLoans.length,
      projectedAutoEligibleLoans: eligible,
      projectedAutoEligiblePercent:
        pendingLoans.length > 0 ? Number(((eligible / pendingLoans.length) * 100).toFixed(2)) : 0,
      averageProjectedScore:
        pendingLoans.length > 0 ? Number((totalScore / pendingLoans.length).toFixed(2)) : 0,
      policy,
    };
  },
};
