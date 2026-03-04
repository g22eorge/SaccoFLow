import { requireSaccoContext } from "@/src/server/auth/rbac";
import { LoansService } from "@/src/server/services/loans.service";
import { MembersService } from "@/src/server/services/members.service";
import { SharesService } from "@/src/server/services/shares.service";
import { LoanManagement } from "@/src/ui/forms/loan-management";
import { SiteHeader } from "@/components/site-header";
import { formatMoney } from "@/src/lib/money";
import Link from "next/link";

const signalTone = (status: "Strong" | "Watch" | "Critical") =>
  status === "Strong"
    ? "text-emerald-700 bg-emerald-50"
    : status === "Watch"
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";

const toNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));

export default async function LoansPage({
  searchParams,
}: {
  searchParams?: { status?: string; page?: string };
}) {
  const { saccoId } = await requireSaccoContext();
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const status = searchParams?.status;
  const [members, loans] = await Promise.all([
    MembersService.list({ saccoId, page: 1 }),
    LoansService.list({ saccoId, status, page }),
  ]);
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
    status: loan.status,
    termMonths: loan.termMonths,
    dueAt: loan.dueAt?.toISOString() ?? null,
    principalAmount: loan.principalAmount.toString(),
    outstandingPrincipal: loan.outstandingPrincipal.toString(),
    outstandingInterest: loan.outstandingInterest.toString(),
    outstandingPenalty: loan.outstandingPenalty.toString(),
  }));

  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    shareBalance: shareBalanceMap.get(member.id) ?? "0",
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

  return (
    <>
      <SiteHeader title="Loans" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
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

                <section className="rounded-lg border bg-card p-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Loan Book</p>
                      <p className="mt-1 text-2xl font-bold">{openLoans.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Approved: {approvedLoans.length} | Active: {activeLoans.length}
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Outstanding</p>
                      <p className="mt-1 text-2xl font-bold">{formatMoney(totalOutstanding)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Principal only: {formatMoney(outstandingPrincipal)}
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Loan Ticket</p>
                      <p className="mt-1 text-2xl font-bold">{formatMoney(averageTicket)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Across all loaded loans</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Approvals</p>
                      <p className="mt-1 text-2xl font-bold">{pendingLoans.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Target {"<= 15"}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Default Rate</p>
                      <p className="mt-1 text-2xl font-bold">{portfolioAtRiskByCount.toFixed(1)}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {defaultedLoans.length} defaulted of {openLoans.length} open
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue Open Loans</p>
                      <p className="mt-1 text-2xl font-bold">{overdueOpenLoans.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{overdueRatio.toFixed(1)}% of open book</p>
                    </article>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Executive Signals</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Target-vs-actual risk checks for faster credit decisions.
                    </p>
                    <div className="mt-4 space-y-3">
                      {decisionSignals.map((signal) => (
                        <article
                          key={signal.name}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{signal.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${signalTone(signal.status)}`}
                            >
                              {signal.status}
                            </span>
                          </div>
                          <p className="mt-1 text-lg font-semibold">{signal.value}</p>
                          <p className="text-xs text-muted-foreground">Target: {signal.target}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Top Exposures</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Largest outstanding positions requiring close monitoring.
                    </p>
                    <div className="mt-4 space-y-2">
                      {topExposures.map((loan) => (
                        <article
                          key={loan.id}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{loan.memberName}</p>
                            <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
                              {loan.status}
                            </span>
                          </div>
                          <p className="mt-1 text-lg font-semibold">{formatMoney(loan.exposure)}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Scenario Outlook</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Stress checks for credit risk and recovery planning.
                    </p>
                    <div className="mt-4 space-y-3">
                      {scenarioCards.map((scenario) => (
                        <article
                          key={scenario.label}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <p className="text-sm font-medium">{scenario.label}</p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatMoney(scenario.projectedLoss)}
                          </p>
                          <p className={`text-xs ${scenario.impact >= 0 ? "text-red-700" : "text-emerald-700"}`}>
                            Impact: {scenario.impact > 0 ? "+" : ""}
                            {formatMoney(scenario.impact)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Priority Actions</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recommended interventions from the current loan risk posture.
                    </p>
                    <div className="mt-4 space-y-3">
                      {actionQueue.length > 0 ? (
                        actionQueue.map((action) => (
                          <article
                            key={action.title}
                            className="rounded-md border bg-background px-4 py-3"
                          >
                            <p className="text-sm font-semibold">{action.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
                            <Link
                              href={action.href}
                              className="mt-2 inline-block text-xs text-[#cc5500]"
                            >
                              Open recommendation
                            </Link>
                          </article>
                        ))
                      ) : (
                        <article className="rounded-md border bg-background px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-700">
                            No immediate intervention flags.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Credit portfolio is within current policy thresholds.
                          </p>
                        </article>
                      )}
                    </div>
                  </section>
                </div>

                <LoanManagement members={memberOptions} loans={loanRows} />

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
