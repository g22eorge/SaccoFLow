import { requireSaccoContext } from "@/src/server/auth/rbac";
import { DashboardService } from "@/src/server/services/dashboard.service";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { formatMoney } from "@/src/lib/money";

const toNumber = (value: string) => Number(value.replaceAll(",", ""));

const toneClass = (value: number) =>
  value >= 0 ? "text-emerald-600" : "text-red-600";

export default async function Page() {
  const { saccoId } = await requireSaccoContext();
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
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Approvals Queue</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.kpis.pendingApprovals}</p>
                        <Link href="/dashboard/loans" className="mt-2 inline-block text-xs text-[#cc5500]">
                          Open loans queue
                        </Link>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Defaulted Loans</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.monitors.defaultedLoans}</p>
                        <Link href="/dashboard/reports" className="mt-2 inline-block text-xs text-[#cc5500]">
                          Review risk report
                        </Link>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Audit Alerts (24h)</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.monitors.auditEvents24h}</p>
                        <Link href="/dashboard/audit-logs" className="mt-2 inline-block text-xs text-[#cc5500]">
                          Open audit logs
                        </Link>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Loan Portfolio</p>
                        <p className="mt-1 text-xl font-semibold">{dashboard.kpis.outstandingPrincipal}</p>
                        <Link href="/dashboard/loans" className="mt-2 inline-block text-xs text-[#cc5500]">
                          View portfolio
                        </Link>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3 sm:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Lending Headroom Breakdown</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Liquidity lendable {dashboard.kpis.lendableFunds} + deployable shares {dashboard.monitors.deployableShareCapital}
                        </p>
                        <p className="mt-1 text-lg font-semibold">{dashboard.kpis.totalLendingHeadroom}</p>
                      </article>
                    </div>
                  </section>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">30 Day Flow Snapshot</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Disbursed</p>
                      <p className="text-2xl font-bold">{dashboard.monitors.monthlyDisbursed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Repaid</p>
                      <p className="text-2xl font-bold">{dashboard.monitors.monthlyRepaid}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Loan Net Flow</p>
                      <p className={`text-2xl font-bold ${toneClass(Number(dashboard.monitors.monthlyLoanNet))}`}>
                        {dashboard.monitors.monthlyLoanNet}
                      </p>
                    </div>
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
