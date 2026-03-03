import Link from "next/link";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { DashboardService } from "@/src/server/services/dashboard.service";
import { formatMoney } from "@/src/lib/money";

const monitorLevel = (value: number, warn: number, danger: number) => {
  if (value >= danger) {
    return "text-red-700";
  }
  if (value >= warn) {
    return "text-amber-700";
  }
  return "text-emerald-700";
};

export default async function DashboardPage() {
  const { saccoId } = await requireSaccoContext();
  const dashboard = await DashboardService.monitors(saccoId);
  const riskClass = monitorLevel(
    dashboard.monitors.portfolioRiskPercent,
    5,
    12,
  );
  const auditClass = monitorLevel(dashboard.monitors.auditEvents24h, 80, 140);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Est. SACCO Value (Savings)
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              {formatMoney(dashboard.kpis.savingsBalance)}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Net 30d flow: {formatMoney(dashboard.monitors.monthlySavingsNet)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Updated: {dashboard.generatedAt.toLocaleString()}
            </p>
          </div>
          <Link
            href="/savings"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            Add Funds
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Members
          </p>
          <p className="mt-2 text-2xl font-bold">
            {dashboard.kpis.membersTotal}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Active: {dashboard.kpis.membersActive}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Savings Balance
          </p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(dashboard.kpis.savingsBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Net 30d: {formatMoney(dashboard.monitors.monthlySavingsNet)}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Loan Exposure
          </p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(dashboard.kpis.outstandingPrincipal)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Open loans: {dashboard.kpis.loansOpen}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Pending Approvals
          </p>
          <p className="mt-2 text-2xl font-bold">
            {dashboard.kpis.pendingApprovals}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Cleared loans: {dashboard.kpis.loansCleared}
          </p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Portfolio Risk Monitor</h2>
          <p className={`mt-3 text-3xl font-bold ${riskClass}`}>
            {dashboard.monitors.portfolioRiskPercent}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Defaulted loans in open portfolio:{" "}
            {dashboard.monitors.defaultedLoans}
          </p>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Loan Cashflow 30d</h2>
          <p className="mt-3 text-sm">
            Disbursed:{" "}
            <span className="font-semibold">
              {formatMoney(dashboard.monitors.monthlyDisbursed)}
            </span>
          </p>
          <p className="mt-1 text-sm">
            Repaid:{" "}
            <span className="font-semibold">
              {formatMoney(dashboard.monitors.monthlyRepaid)}
            </span>
          </p>
          <p className="mt-3 text-sm">
            Net flow:{" "}
            <span className="font-semibold">
              {formatMoney(dashboard.monitors.monthlyLoanNet)}
            </span>
          </p>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Control Activity 24h</h2>
          <p className={`mt-3 text-3xl font-bold ${auditClass}`}>
            {dashboard.monitors.auditEvents24h}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Audit events in last 24 hours
          </p>
        </article>
      </div>

      <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Recent Activity Monitor</h2>
        <ul className="space-y-2">
          {dashboard.recentActivity.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-border/70 p-3 text-sm"
            >
              <p className="font-medium">{event.label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {event.when.toLocaleString()}
              </p>
            </li>
          ))}
          {dashboard.recentActivity.length === 0 ? (
            <li className="rounded-lg border border-border/70 p-3 text-sm text-slate-500">
              No activity recorded yet.
            </li>
          ) : null}
        </ul>
      </article>
    </section>
  );
}
