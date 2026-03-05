import { requireSaccoContext } from "@/src/server/auth/rbac";
import { DashboardService } from "@/src/server/services/dashboard.service";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { formatMoney } from "@/src/lib/money";
import { redirect } from "next/navigation";

const toNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));

const toneClass = (value: number) =>
  value >= 0 ? "text-emerald-600" : "text-red-600";

const signalTone = (status: "Strong" | "Watch" | "Critical") =>
  status === "Strong"
    ? "text-emerald-700 bg-emerald-50"
    : status === "Watch"
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";

export default async function Page() {
  const { saccoId, role } = await requireSaccoContext();
  if (role === "MEMBER") {
    redirect("/dashboard/member");
  }
  if (
    ![
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "CHAIRPERSON",
      "BOARD_MEMBER",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
      "MEMBER",
    ].includes(role)
  ) {
    redirect("/dashboard");
  }
  const dashboard = await DashboardService.monitors(saccoId);

  const equity = toNumber(dashboard.kpis.totalShareCapital);
  const savingsPool = toNumber(dashboard.kpis.savingsBalance);
  const externalCapital = 0;
  const capitalBase = equity + savingsPool + externalCapital;
  const equityShare = capitalBase > 0 ? (equity / capitalBase) * 100 : 0;
  const savingsShare = capitalBase > 0 ? (savingsPool / capitalBase) * 100 : 0;
  const externalShare = capitalBase > 0 ? (externalCapital / capitalBase) * 100 : 0;

  const monthlySavingsNet = Number(dashboard.monitors.monthlySavingsNet);
  const monthlyLoanNet = Number(dashboard.monitors.monthlyLoanNet);
  const netSurplus30d = monthlySavingsNet + monthlyLoanNet;
  const disbursed30d = toNumber(dashboard.monitors.monthlyDisbursed);
  const repaid30d = toNumber(dashboard.monitors.monthlyRepaid);
  const loanNetFlow30d = repaid30d - disbursed30d;
  const collectionEfficiency =
    disbursed30d > 0 ? (repaid30d / disbursed30d) * 100 : 0;
  const collectionTarget = 100;
  const collectionGap = collectionEfficiency - collectionTarget;
  const flowStatus =
    collectionEfficiency >= 100 && loanNetFlow30d >= 0
      ? ("Strong" as const)
      : collectionEfficiency >= 90
        ? ("Watch" as const)
        : ("Critical" as const);
  const flowInsight =
    flowStatus === "Strong"
      ? `Collections exceed disbursements by ${formatMoney(loanNetFlow30d)} in the last 30 days.`
      : flowStatus === "Watch"
        ? "Collections are close to pace but need tighter weekly follow-up."
        : "Collections are trailing disbursements; tighten underwriting and recovery immediately.";
  const lendableFunds = toNumber(dashboard.kpis.lendableFunds);
  const deployableShareCapital = toNumber(
    dashboard.monitors.deployableShareCapital,
  );
  const capitalCapacity = toNumber(dashboard.kpis.capitalSupportedCapacity);
  const lendingHeadroom = toNumber(dashboard.kpis.totalLendingHeadroom);
  const outstandingPrincipal = toNumber(dashboard.kpis.outstandingPrincipal);
  const portfolioRiskPercent = Number(dashboard.monitors.portfolioRiskPercent);
  const pendingApprovals = Number(dashboard.kpis.pendingApprovals);
  const pendingLoanRequests = Number(dashboard.kpis.pendingLoanRequests ?? 0);
  const pendingMemberRequests = Number(dashboard.kpis.pendingMemberRequests ?? 0);
  const utilizationPercent =
    capitalCapacity > 0 ? (outstandingPrincipal / capitalCapacity) * 100 : 0;

  const decisionSignals = [
    {
      name: "Portfolio at Risk",
      value: `${portfolioRiskPercent.toFixed(1)}%`,
      target: "<= 8%",
      status:
        portfolioRiskPercent <= 8
          ? ("Strong" as const)
          : portfolioRiskPercent <= 12
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Lending Utilization",
      value: `${utilizationPercent.toFixed(1)}%`,
      target: "65% - 85%",
      status:
        utilizationPercent >= 65 && utilizationPercent <= 85
          ? ("Strong" as const)
          : utilizationPercent <= 95
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Approvals Backlog",
      value: `${pendingApprovals}`,
      target: "<= 15",
      status:
        pendingApprovals <= 15
          ? ("Strong" as const)
          : pendingApprovals <= 30
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "30D Net Surplus",
      value: formatMoney(netSurplus30d),
      target: ">= 0",
      status:
        netSurplus30d >= 0
          ? ("Strong" as const)
          : netSurplus30d >= -0.1 * Math.max(capitalBase, 1)
            ? ("Watch" as const)
            : ("Critical" as const),
    },
  ];

  const scenarioCards = [
    {
      label: "Base Case",
      effect: 0,
      headroom: lendingHeadroom,
    },
    {
      label: "Liquidity Stress",
      effect: -(lendableFunds * 0.15),
      headroom: Math.max(0, lendingHeadroom - lendableFunds * 0.15),
    },
    {
      label: "Risk + Liquidity Stress",
      effect: -(lendableFunds * 0.25 + outstandingPrincipal * 0.05),
      headroom: Math.max(
        0,
        lendingHeadroom - (lendableFunds * 0.25 + outstandingPrincipal * 0.05),
      ),
    },
  ];

  const actionQueue = [
    pendingApprovals > 15
      ? {
          title: "Clear loan approvals queue",
          detail: `${pendingApprovals} approvals pending decision`,
          href: "/dashboard/loans",
        }
      : null,
    portfolioRiskPercent > 8
      ? {
          title: "Run delinquency intervention",
          detail: `PAR is ${portfolioRiskPercent.toFixed(1)}%, above target`,
          href: "/dashboard/reports",
        }
      : null,
    netSurplus30d < 0
      ? {
          title: "Protect cash in next 30 days",
          detail: `Net surplus is ${formatMoney(netSurplus30d)} and needs correction`,
          href: "/dashboard/settings",
        }
      : null,
    pendingMemberRequests > 0
      ? {
          title: "Review member service requests",
          detail: `${pendingMemberRequests} member requests are awaiting resolution`,
          href: "/dashboard/member-requests",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; href: string }>;

  return (
    <>
      <SiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Executive View
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Decision Dashboard</h1>
                  <p className="mt-2 text-muted-foreground">
                    Capital health, portfolio risk, and action queues in one snapshot.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">Total Capital Base</p>
                    <p className="mt-1 text-2xl font-bold">{formatMoney(capitalBase)}</p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">Liquidity Lendable</p>
                    <p className="mt-1 text-2xl font-bold">{dashboard.kpis.lendableFunds}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      After reserve ({dashboard.monitors.liquidityReserveRatioPercent}%) and pending disbursements
                    </p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">Capital-Supported Capacity</p>
                    <p className="mt-1 text-2xl font-bold">{dashboard.kpis.capitalSupportedCapacity}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Includes deployable shares ({dashboard.monitors.deployableShareCapitalRatioPercent}%)
                    </p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">Portfolio at Risk</p>
                    <p className="mt-1 text-2xl font-bold">{dashboard.monitors.portfolioRiskPercent}%</p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">30D Net Surplus</p>
                    <p className={`mt-1 text-2xl font-bold ${toneClass(netSurplus30d)}`}>
                      {formatMoney(netSurplus30d)}
                    </p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">Pending Approvals</p>
                    <p className="mt-1 text-2xl font-bold">{dashboard.kpis.pendingApprovals}</p>
                  </article>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Capital Health</h2>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>Equity (Share Capital)</span>
                          <span>{equityShare.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-[#cc5500]" style={{ width: `${equityShare}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>Member Savings Pool</span>
                          <span>{savingsShare.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${savingsShare}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>External Capital</span>
                          <span>{externalShare.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-slate-500" style={{ width: `${externalShare}%` }} />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Operational Pressure</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <article className="flex h-full flex-col justify-between rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Approvals Queue</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.kpis.pendingApprovals}</p>
                        <Link href="/dashboard/loans" className="mt-2 inline-block text-xs text-[#cc5500]">
                          Open loans queue
                        </Link>
                      </article>
                      <article className="flex h-full flex-col justify-between rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Defaulted Loans</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.monitors.defaultedLoans}</p>
                        <Link href="/dashboard/reports" className="mt-2 inline-block text-xs text-[#cc5500]">
                          Review risk report
                        </Link>
                      </article>
                      <article className="flex h-full flex-col justify-between rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Audit Alerts (24h)</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.monitors.auditEvents24h}</p>
                        <Link href="/dashboard/audit-logs" className="mt-2 inline-block text-xs text-[#cc5500]">
                          Open audit logs
                        </Link>
                      </article>
                      <article className="flex h-full flex-col justify-between rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Loan Portfolio</p>
                        <p className="mt-1 text-xl font-semibold">{formatMoney(outstandingPrincipal)}</p>
                        <Link href="/dashboard/loans" className="mt-2 inline-block text-xs text-[#cc5500]">
                          View portfolio
                        </Link>
                      </article>
                      <article className="flex h-full flex-col justify-between rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Liquidity Lendable</p>
                        <p className="mt-1 text-xl font-semibold">{formatMoney(lendableFunds)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Available after reserve and pending disbursements.
                        </p>
                      </article>
                      <article className="flex h-full flex-col justify-between rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Lending Headroom</p>
                        <p className="mt-1 text-xl font-semibold">{formatMoney(lendingHeadroom)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Includes deployable shares {formatMoney(deployableShareCapital)}.
                        </p>
                      </article>
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Executive Signals</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Target-vs-actual scorecards to speed board-level decisions.
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
                    <h2 className="text-lg font-semibold">Scenario Outlook</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Quick stress checks on lending headroom under adverse assumptions.
                    </p>
                    <div className="mt-4 space-y-3">
                      {scenarioCards.map((scenario) => (
                        <article
                          key={scenario.label}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <p className="text-sm font-medium">{scenario.label}</p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatMoney(scenario.headroom)}
                          </p>
                          <p className={`text-xs ${toneClass(scenario.effect)}`}>
                            Headroom impact: {formatMoney(scenario.effect)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Requests Watchlist</h2>
                    <p className="text-xs text-muted-foreground">Time-sensitive member and loan decisions</p>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Loan Requests</p>
                      <p className="mt-1 text-2xl font-bold">{pendingLoanRequests}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Applications waiting for initial review.
                      </p>
                      <Link href="/dashboard/loans" className="mt-2 inline-block text-xs text-[#cc5500]">
                        Open loan requests
                      </Link>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Member Requests</p>
                      <p className="mt-1 text-2xl font-bold">{pendingMemberRequests}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Withdrawals and share redemptions pending review.
                      </p>
                      <Link href="/dashboard/member-requests" className="mt-2 inline-block text-xs text-[#cc5500]">
                        Open member requests
                      </Link>
                    </article>
                  </div>
                </section>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Priority Actions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Suggested next moves based on today&apos;s pressure signals.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
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
                      <article className="rounded-md border bg-background px-4 py-3 md:col-span-3">
                        <p className="text-sm font-semibold text-emerald-700">
                          No immediate intervention flags.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Continue normal monitoring cadence and review weekly trend shifts.
                        </p>
                      </article>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">30 Day Flow Intelligence</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${signalTone(flowStatus)}`}
                    >
                      {flowStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Lending cash cycle quality with collection efficiency against target.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Disbursed</p>
                      <p className="mt-1 text-2xl font-bold">{formatMoney(disbursed30d)}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Repaid</p>
                      <p className="mt-1 text-2xl font-bold">{formatMoney(repaid30d)}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Lending Position</p>
                      <p className={`mt-1 text-2xl font-bold ${toneClass(loanNetFlow30d)}`}>
                        {formatMoney(loanNetFlow30d)}
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Collection Efficiency</p>
                      <p className={`mt-1 text-2xl font-bold ${toneClass(collectionGap)}`}>
                        {collectionEfficiency.toFixed(1)}%
                      </p>
                      <p className={`mt-1 text-xs ${toneClass(collectionGap)}`}>
                        vs target {collectionTarget}%: {collectionGap >= 0 ? "+" : ""}
                        {collectionGap.toFixed(1)}pp
                      </p>
                    </article>
                  </div>
                  <p className="mt-4 rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground">
                    {flowInsight}
                  </p>
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
