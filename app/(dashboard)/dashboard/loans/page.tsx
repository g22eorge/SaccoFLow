import { requireSaccoContext } from "@/src/server/auth/rbac";
import { LoansService } from "@/src/server/services/loans.service";
import { LoanProductsService } from "@/src/server/services/loan-products.service";
import { MembersService } from "@/src/server/services/members.service";
import { SharesService } from "@/src/server/services/shares.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { LoanManagement } from "@/src/ui/forms/loan-management";
import { SiteHeader } from "@/components/site-header";
import { formatMoney } from "@/src/lib/money";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/src/server/db/prisma";

const signalTone = (status: "Strong" | "Watch" | "Critical") =>
  status === "Strong"
    ? "text-emerald-700 bg-emerald-50"
    : status === "Watch"
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";

const toNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));
const DAY_MS = 24 * 60 * 60 * 1000;

const detectAutoDecisionPolicy = (auto: {
  greenMinScore: number;
  creditCapacityMultiplier: number;
  minRepaymentCount: number;
  requireAnyClearedLoan: boolean;
  earlyWarningWatchDays: number;
}) => {
  if (
    auto.greenMinScore === 78 &&
    auto.creditCapacityMultiplier === 2.5 &&
    auto.minRepaymentCount === 4 &&
    auto.requireAnyClearedLoan === true &&
    auto.earlyWarningWatchDays === 30
  ) {
    return "Balanced";
  }

  if (
    auto.greenMinScore === 85 &&
    auto.creditCapacityMultiplier === 2 &&
    auto.minRepaymentCount === 6 &&
    auto.requireAnyClearedLoan === true &&
    auto.earlyWarningWatchDays === 45
  ) {
    return "Conservative";
  }

  if (
    auto.greenMinScore === 70 &&
    auto.creditCapacityMultiplier === 3 &&
    auto.minRepaymentCount === 3 &&
    auto.requireAnyClearedLoan === false &&
    auto.earlyWarningWatchDays === 21
  ) {
    return "Aggressive";
  }

  return "Custom";
};

export default async function LoansPage({
  searchParams,
}: {
  searchParams?: { status?: string; page?: string };
}) {
  const { saccoId, role } = await requireSaccoContext();
  if (
    !["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "LOAN_OFFICER"].includes(role)
  ) {
    redirect("/dashboard");
  }
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const status = searchParams?.status;
  const [members, loans, loanProducts, settings] = await Promise.all([
    MembersService.list({ saccoId, page: 1 }),
    LoansService.list({ saccoId, status, page }),
    LoanProductsService.list(saccoId),
    SettingsService.get(saccoId),
  ]);
  const scheduleApprovals = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "LoanScheduleApproval",
    },
    select: {
      entityId: true,
      action: true,
      afterJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const approvalMatrixStates = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "LoanApprovalMatrixState",
      entityId: { in: loans.map((loan) => loan.id) },
    },
    select: {
      entityId: true,
      afterJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const scheduleApprovalMetaByLoanId = new Map<
    string,
    {
      approved: boolean;
      autoApproved: boolean;
      reasonCodes: string[];
      score: number | null;
      riskTier: string | null;
    }
  >();
  for (const entry of scheduleApprovals) {
    const loanId = entry.entityId.split(":")[0];
    if (scheduleApprovalMetaByLoanId.has(loanId)) {
      continue;
    }
    let after: {
      approvalMode?: string;
      assessment?: { reasonCodes?: string[]; score?: number; riskTier?: string };
    } | null = null;
    if (entry.afterJson) {
      try {
        after = JSON.parse(entry.afterJson) as {
          approvalMode?: string;
          assessment?: { reasonCodes?: string[]; score?: number; riskTier?: string };
        };
      } catch {
        after = null;
      }
    }
    scheduleApprovalMetaByLoanId.set(loanId, {
      approved: true,
      autoApproved: entry.action === "AUTO_APPROVE" || String(after?.approvalMode ?? "").startsWith("AUTO_"),
      reasonCodes: Array.isArray(after?.assessment?.reasonCodes) ? after.assessment.reasonCodes : [],
      score: typeof after?.assessment?.score === "number" ? after.assessment.score : null,
      riskTier: typeof after?.assessment?.riskTier === "string" ? after.assessment.riskTier : null,
    });
  }
  const approvalMatrixByLoanId = new Map<
    string,
    {
      requiredApproverCount: number;
      approvalsCount: number;
      completed: boolean;
      slaDueAtIso: string | null;
      requiredRoleGroups: string[];
    }
  >();
  for (const entry of approvalMatrixStates) {
    if (approvalMatrixByLoanId.has(entry.entityId)) {
      continue;
    }
    if (!entry.afterJson) {
      continue;
    }
    try {
      const payload = JSON.parse(entry.afterJson) as {
        requiredApproverCount?: number;
        approvals?: unknown[];
        completed?: boolean;
        slaDueAtIso?: string;
        requiredRoleGroups?: string[];
      };
      approvalMatrixByLoanId.set(entry.entityId, {
        requiredApproverCount: Number(payload.requiredApproverCount ?? 1),
        approvalsCount: Array.isArray(payload.approvals) ? payload.approvals.length : 0,
        completed: Boolean(payload.completed),
        slaDueAtIso: typeof payload.slaDueAtIso === "string" ? payload.slaDueAtIso : null,
        requiredRoleGroups: Array.isArray(payload.requiredRoleGroups)
          ? payload.requiredRoleGroups.filter((value) => typeof value === "string")
          : [],
      });
    } catch {
      continue;
    }
  }
  const hasNextPage = loans.length === 30;
  const shareBalances = await Promise.all(
    members.map(async (member) => ({
      memberId: member.id,
      balance: await SharesService.getMemberShareBalance(saccoId, member.id),
    })),
  );
  const shareBalanceMap = new Map(
    shareBalances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const memberMap = new Map(
    members.map((member) => [
      member.id,
      `${member.memberNumber} - ${member.fullName}`,
    ]),
  );

  const loanRows = loans.map((loan) => ({
    id: loan.id,
    memberId: loan.memberId,
    memberName: memberMap.get(loan.memberId) ?? loan.memberId,
    loanProductId: loan.loanProduct?.id ?? null,
    loanProductName: loan.loanProduct?.name ?? "Unspecified product",
    status: loan.status,
    termMonths: loan.termMonths,
    dueAt: loan.dueAt?.toISOString() ?? null,
    principalAmount: loan.principalAmount.toString(),
    outstandingPrincipal: loan.outstandingPrincipal.toString(),
    outstandingInterest: loan.outstandingInterest.toString(),
    outstandingPenalty: loan.outstandingPenalty.toString(),
    scheduleApprovedByMember: scheduleApprovalMetaByLoanId.has(loan.id),
    scheduleAutoApproved: scheduleApprovalMetaByLoanId.get(loan.id)?.autoApproved ?? false,
    scheduleApprovalScore: scheduleApprovalMetaByLoanId.get(loan.id)?.score ?? null,
    scheduleApprovalRiskTier: scheduleApprovalMetaByLoanId.get(loan.id)?.riskTier ?? null,
    scheduleApprovalReasons: scheduleApprovalMetaByLoanId.get(loan.id)?.reasonCodes ?? [],
    approvalRequiredCount:
      approvalMatrixByLoanId.get(loan.id)?.requiredApproverCount ??
      Number(settings.approvalWorkflow.requiredApproverCount ?? 1),
    approvalCurrentCount: approvalMatrixByLoanId.get(loan.id)?.approvalsCount ?? 0,
    approvalCompleted: approvalMatrixByLoanId.get(loan.id)?.completed ?? false,
    approvalSlaDueAt: approvalMatrixByLoanId.get(loan.id)?.slaDueAtIso ?? null,
    approvalRoleGroups: approvalMatrixByLoanId.get(loan.id)?.requiredRoleGroups ?? [],
  }));

  const repaymentSummaries =
    loanRows.length > 0
      ? await prisma.loanRepayment.groupBy({
          by: ["loanId"],
          where: {
            saccoId,
            loanId: { in: loanRows.map((loan) => loan.id) },
          },
          _max: { paidAt: true },
          _count: { _all: true },
        })
      : [];

  const repaymentSummaryByLoanId = new Map(
    repaymentSummaries.map((summary) => [
      summary.loanId,
      {
        lastPaidAt: summary._max.paidAt,
        repaymentCount: summary._count._all,
      },
    ]),
  );

  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    shareBalance: shareBalanceMap.get(member.id) ?? "0",
  }));

  const loanProductOptions = loanProducts.map((product) => ({
    id: product.id,
    name: product.name,
    minPrincipal: product.minPrincipal.toString(),
    maxPrincipal: product.maxPrincipal.toString(),
    minTermMonths: product.minTermMonths,
    maxTermMonths: product.maxTermMonths,
    annualRatePercent: product.annualRatePercent?.toString() ?? null,
    monthlyRatePercent: product.monthlyRatePercent?.toString() ?? null,
    repaymentFrequency: product.repaymentFrequency,
    isActive: product.isActive,
    isDefault: product.isDefault,
  }));

  const now = new Date();
  const openLoans = loanRows.filter((loan) => loan.status !== "CLEARED");
  const pendingLoans = loanRows.filter((loan) => loan.status === "PENDING");
  const approvedLoans = loanRows.filter((loan) => loan.status === "APPROVED");
  const activeLoans = loanRows.filter((loan) => ["ACTIVE", "DISBURSED"].includes(loan.status));
  const defaultedLoans = loanRows.filter((loan) => loan.status === "DEFAULTED");
  const overdueOpenLoans = openLoans.filter(
    (loan) => loan.dueAt && new Date(loan.dueAt).getTime() < now.getTime(),
  );

  const totalPrincipal = loanRows.reduce(
    (sum, loan) => sum + toNumber(loan.principalAmount),
    0,
  );
  const totalOutstanding = loanRows.reduce(
    (sum, loan) =>
      sum +
      toNumber(loan.outstandingPrincipal) +
      toNumber(loan.outstandingInterest) +
      toNumber(loan.outstandingPenalty),
    0,
  );
  const outstandingPrincipal = loanRows.reduce(
    (sum, loan) => sum + toNumber(loan.outstandingPrincipal),
    0,
  );
  const outstandingPenalty = loanRows.reduce(
    (sum, loan) => sum + toNumber(loan.outstandingPenalty),
    0,
  );
  const averageTicket = loanRows.length > 0 ? totalPrincipal / loanRows.length : 0;
  const portfolioAtRiskByCount =
    openLoans.length > 0 ? (defaultedLoans.length / openLoans.length) * 100 : 0;
  const overdueRatio =
    openLoans.length > 0 ? (overdueOpenLoans.length / openLoans.length) * 100 : 0;
  const defaultedExposure = defaultedLoans.reduce(
    (sum, loan) =>
      sum +
      toNumber(loan.outstandingPrincipal) +
      toNumber(loan.outstandingInterest) +
      toNumber(loan.outstandingPenalty),
    0,
  );

  const earlyWarnings = activeLoans
    .map((loan) => {
      const dueAtTime = loan.dueAt ? new Date(loan.dueAt).getTime() : null;
      const daysToDue =
        dueAtTime === null ? null : Math.ceil((dueAtTime - now.getTime()) / DAY_MS);
      const repaymentSummary = repaymentSummaryByLoanId.get(loan.id);
      const lastPaidAtTime = repaymentSummary?.lastPaidAt
        ? new Date(repaymentSummary.lastPaidAt).getTime()
        : null;
      const daysSinceLastRepayment =
        lastPaidAtTime === null
          ? null
          : Math.floor((now.getTime() - lastPaidAtTime) / DAY_MS);

      const outstandingExposure =
        toNumber(loan.outstandingPrincipal) +
        toNumber(loan.outstandingInterest) +
        toNumber(loan.outstandingPenalty);
      const principal = Math.max(1, toNumber(loan.principalAmount));
      const outstandingRatio = outstandingExposure / principal;

      let severity: "High" | "Medium" | "Watch" | null = null;
      let reason = "";
      let recommendation = "";
      let priorityScore = 0;

      if (daysToDue !== null && daysToDue < 0) {
        severity = "High";
        reason = `${Math.abs(daysToDue)} days overdue`;
        recommendation = "Call member today and agree a recovery plan within 48 hours.";
        priorityScore = 100 + Math.abs(daysToDue);
      } else if (
        (daysToDue !== null &&
          daysToDue <= settings.autoDecision.earlyWarningEscalationDays &&
          (daysSinceLastRepayment === null ||
            daysSinceLastRepayment > settings.autoDecision.earlyWarningNoRepaymentDays)) ||
        (daysToDue !== null &&
          daysToDue <= settings.autoDecision.earlyWarningWatchDays &&
          outstandingRatio >= settings.autoDecision.earlyWarningHighOutstandingRatio)
      ) {
        severity = "Medium";
        reason =
          daysSinceLastRepayment === null || daysSinceLastRepayment > 30
            ? "No recent repayment activity"
            : "High outstanding ratio near maturity";
        recommendation = "Send reminder now and schedule follow-up within 3 days.";
        priorityScore =
          70 +
          (daysToDue !== null
            ? Math.max(0, settings.autoDecision.earlyWarningWatchDays - daysToDue)
            : 0);
      } else if (
        daysToDue !== null &&
        daysToDue <= settings.autoDecision.earlyWarningWatchDays
      ) {
        severity = "Watch";
        reason = `Due in ${daysToDue} days`;
        recommendation = "Push proactive reminder and monitor weekly until due date.";
        priorityScore =
          40 + Math.max(0, settings.autoDecision.earlyWarningWatchDays - daysToDue);
      }

      if (!severity) {
        return null;
      }

      return {
        loanId: loan.id,
        memberName: loan.memberName,
        severity,
        reason,
        recommendation,
        priorityScore,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, settings.autoDecision.earlyWarningMaxCases);

  const decisionSignals = [
    {
      name: "Approval Queue",
      value: `${pendingLoans.length}`,
      target: "<= 15",
      status:
        pendingLoans.length <= 15
          ? ("Strong" as const)
          : pendingLoans.length <= 30
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Default Rate (Open Book)",
      value: `${portfolioAtRiskByCount.toFixed(1)}%`,
      target: "<= 8%",
      status:
        portfolioAtRiskByCount <= 8
          ? ("Strong" as const)
          : portfolioAtRiskByCount <= 12
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Overdue Ratio",
      value: `${overdueRatio.toFixed(1)}%`,
      target: "<= 15%",
      status:
        overdueRatio <= 15
          ? ("Strong" as const)
          : overdueRatio <= 25
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Penalty Load",
      value: formatMoney(outstandingPenalty),
      target: "Low and stable",
      status:
        outstandingPenalty <= outstandingPrincipal * 0.03
          ? ("Strong" as const)
          : outstandingPenalty <= outstandingPrincipal * 0.07
            ? ("Watch" as const)
            : ("Critical" as const),
    },
  ];

  const scenarioCards = [
    {
      label: "Base Case",
      impact: 0,
      projectedLoss: defaultedExposure,
    },
    {
      label: "Default Rate +5pp",
      impact: outstandingPrincipal * 0.05,
      projectedLoss: defaultedExposure + outstandingPrincipal * 0.05,
    },
    {
      label: "Recovery Drive -10% Loss",
      impact: -defaultedExposure * 0.1,
      projectedLoss: Math.max(0, defaultedExposure * 0.9),
    },
  ];

  const topExposures = [...loanRows]
    .map((loan) => ({
      id: loan.id,
      memberName: loan.memberName,
      status: loan.status,
      exposure:
        toNumber(loan.outstandingPrincipal) +
        toNumber(loan.outstandingInterest) +
        toNumber(loan.outstandingPenalty),
    }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 5);

  const actionQueue = [
    pendingLoans.length > 15
      ? {
          title: "Clear pending approvals",
          detail: `${pendingLoans.length} applications waiting decision`,
          href: "/dashboard/loans",
        }
      : null,
    portfolioAtRiskByCount > 8
      ? {
          title: "Start delinquency intervention",
          detail: `Default rate is ${portfolioAtRiskByCount.toFixed(1)}% of open loans`,
          href: "/dashboard/reports",
        }
      : null,
    overdueOpenLoans.length > 0
      ? {
          title: "Prioritize overdue collection",
          detail: `${overdueOpenLoans.length} open loans are past due date`,
          href: "/dashboard/loans",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; href: string }>;

  const policyLabel = detectAutoDecisionPolicy(settings.autoDecision);

  return (
    <>
      <SiteHeader title="Loans" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                        Credit Desk
                      </p>
                      <h1 className="mt-2 text-2xl font-bold">Loans</h1>
                      <p className="mt-2 text-muted-foreground">
                        Process loan applications from submission to repayment.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {new Date().toLocaleString()} | Page {page}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/api/loans/export?format=csv&${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) }).toString()}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export CSV
                      </Link>
                      <Link
                        href={`/api/loans/export?format=pdf&${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) }).toString()}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export PDF
                      </Link>
                    </div>
                  </div>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Portfolio Snapshot</h2>
                  <div className="mt-4 overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Metric</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Open Loan Book</td>
                          <td className="px-3 py-2 text-xs font-semibold">{openLoans.length}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">Approved: {approvedLoans.length} | Active: {activeLoans.length}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Total Outstanding</td>
                          <td className="px-3 py-2 text-xs font-semibold">{formatMoney(totalOutstanding)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">Principal only: {formatMoney(outstandingPrincipal)}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Average Loan Ticket</td>
                          <td className="px-3 py-2 text-xs font-semibold">{formatMoney(averageTicket)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">Across all loaded loans</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Pending Approvals</td>
                          <td className="px-3 py-2 text-xs font-semibold">{pendingLoans.length}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">Target {"<= 15"}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Default Rate</td>
                          <td className="px-3 py-2 text-xs font-semibold">{portfolioAtRiskByCount.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{defaultedLoans.length} defaulted of {openLoans.length} open</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Overdue Open Loans</td>
                          <td className="px-3 py-2 text-xs font-semibold">{overdueOpenLoans.length}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{overdueRatio.toFixed(1)}% of open book</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Executive Signals</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Target-vs-actual risk checks for faster credit decisions.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Signal</th>
                            <th className="px-3 py-2">Value</th>
                            <th className="px-3 py-2">Target</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {decisionSignals.map((signal) => (
                            <tr key={signal.name} className="border-t">
                              <td className="px-3 py-2 text-xs">{signal.name}</td>
                              <td className="px-3 py-2 text-xs font-semibold">{signal.value}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{signal.target}</td>
                              <td className="px-3 py-2 text-xs">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${signalTone(signal.status)}`}>
                                  {signal.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Top Exposures</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Largest outstanding positions requiring close monitoring.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Member</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Exposure</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topExposures.map((loan) => (
                            <tr key={loan.id} className="border-t">
                              <td className="px-3 py-2 text-xs">{loan.memberName}</td>
                              <td className="px-3 py-2 text-xs">{loan.status}</td>
                              <td className="px-3 py-2 text-xs font-semibold">{formatMoney(loan.exposure)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Scenario Outlook</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Stress checks for credit risk and recovery planning.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Scenario</th>
                            <th className="px-3 py-2">Projected Loss</th>
                            <th className="px-3 py-2">Impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scenarioCards.map((scenario) => (
                            <tr key={scenario.label} className="border-t">
                              <td className="px-3 py-2 text-xs">{scenario.label}</td>
                              <td className="px-3 py-2 text-xs font-semibold">{formatMoney(scenario.projectedLoss)}</td>
                              <td className={`px-3 py-2 text-xs ${scenario.impact >= 0 ? "text-red-700" : "text-emerald-700"}`}>
                                {scenario.impact > 0 ? "+" : ""}
                                {formatMoney(scenario.impact)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Priority Actions</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recommended interventions from the current loan risk posture.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border">
                      {actionQueue.length > 0 ? (
                        <table className="w-full min-w-[520px] text-sm">
                          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2">Action</th>
                              <th className="px-3 py-2">Detail</th>
                              <th className="px-3 py-2">Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actionQueue.map((action) => (
                              <tr key={action.title} className="border-t">
                                <td className="px-3 py-2 text-xs font-semibold">{action.title}</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{action.detail}</td>
                                <td className="px-3 py-2 text-xs">
                                  <Link href={action.href} className="text-[#cc5500]">Open recommendation</Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-700">No immediate intervention flags.</p>
                          <p className="mt-1 text-xs text-muted-foreground">Credit portfolio is within current policy thresholds.</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Credit Policy Snapshot</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Active automation and early-warning policy currently in use.
                      </p>
                    </div>
                    <span className="rounded-full border border-[#cc5500] bg-orange-50 px-3 py-1 text-xs font-semibold text-[#cc5500]">
                      {policyLabel}
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Setting</th>
                          <th className="px-3 py-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Green Min Score</td>
                          <td className="px-3 py-2 text-xs font-semibold">{settings.autoDecision.greenMinScore}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Capacity Multiplier</td>
                          <td className="px-3 py-2 text-xs font-semibold">{settings.autoDecision.creditCapacityMultiplier}x</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Min Repayments</td>
                          <td className="px-3 py-2 text-xs font-semibold">{settings.autoDecision.minRepaymentCount}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-xs">Warning Watch Window</td>
                          <td className="px-3 py-2 text-xs font-semibold">{settings.autoDecision.earlyWarningWatchDays} days</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Change this under Settings → Lending → Auto Decisions presets.
                  </p>
                </section>

                {settings.autoDecision.enableDelinquencyEarlyWarnings ? (
                  <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Delinquency Early Warnings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Heuristic risk engine highlights accounts likely to slip before default.
                  </p>
                  <div className="mt-4 overflow-x-auto rounded-lg border">
                    {earlyWarnings.length > 0 ? (
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Member</th>
                            <th className="px-3 py-2">Severity</th>
                            <th className="px-3 py-2">Signal</th>
                            <th className="px-3 py-2">Recommended Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {earlyWarnings.map((warning) => (
                            <tr key={warning.loanId} className="border-t">
                              <td className="px-3 py-2 text-xs font-semibold">{warning.memberName}</td>
                              <td className="px-3 py-2 text-xs">{warning.severity}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{warning.reason}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{warning.recommendation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-sm font-semibold text-emerald-700">No early warning flags right now.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Active loans are currently within expected repayment trajectory.</p>
                      </div>
                    )}
                  </div>
                  </section>
                ) : null}

                <LoanManagement members={memberOptions} loans={loanRows} loanProducts={loanProductOptions} />

                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={
                        page > 1
                          ? `/dashboard/loans?${new URLSearchParams({
                              ...(status ? { status } : {}),
                              page: String(page - 1),
                            }).toString()}`
                          : "#"
                      }
                      className={`text-sm ${page > 1 ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Previous
                    </Link>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Link
                      href={
                        hasNextPage
                          ? `/dashboard/loans?${new URLSearchParams({
                              ...(status ? { status } : {}),
                              page: String(page + 1),
                            }).toString()}`
                          : "#"
                      }
                      className={`text-sm ${hasNextPage ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Next
                    </Link>
                  </div>
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
