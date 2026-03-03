import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { ReportsService } from "@/src/server/services/reports.service";
import { MembersService } from "@/src/server/services/members.service";
import { MemberStatementForm } from "@/src/ui/forms/member-statement-form";
import { formatMoney } from "@/src/lib/money";

const periodLabels: Record<string, string> = {
  daily: "Today",
  weekly: "Last 7 Days",
  monthly: "This Month",
};

export default async function ReportsPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (
    ![
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ].includes(role)
  ) {
    redirect("/dashboard");
  }
  const [daily, weekly, monthly, members, auditLogs] = await Promise.all([
    ReportsService.summary("daily", saccoId),
    ReportsService.summary("weekly", saccoId),
    ReportsService.summary("monthly", saccoId),
    MembersService.list({ saccoId, page: 1 }),
    ReportsService.auditTrail({ saccoId, page: 1 }),
  ]);

  const periodCards = [daily, weekly, monthly];
  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
  }));

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Insights
        </p>
        <h1 className="mt-2 text-2xl font-bold">Reports & Audit</h1>
        <p className="mt-2 text-slate-600">
          Track daily performance, generate member statements, and review change
          history.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {periodCards.map((summary) => (
          <article
            key={summary.period}
            className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold">
              {periodLabels[summary.period]}
            </h2>
            <p className="text-xs text-slate-500">
              {new Date(summary.window.start).toLocaleString()} -{" "}
              {new Date(summary.window.end).toLocaleString()}
            </p>
            <div className="space-y-1 text-sm">
              <p>
                Members:{" "}
                <span className="font-semibold">{summary.memberCount}</span>
              </p>
              <p>
                New members:{" "}
                <span className="font-semibold">
                  {summary.memberJoinedCount}
                </span>
              </p>
              <p>
                Active loans:{" "}
                <span className="font-semibold">{summary.activeLoans}</span>
              </p>
              <p>
                Loan applications:{" "}
                <span className="font-semibold">
                  {summary.loanAppliedCount}
                </span>
              </p>
              <p>
                Deposits:{" "}
                <span className="font-semibold">
                  {formatMoney(summary.totals.savingsDeposits)}
                </span>
              </p>
              <p>
                Withdrawals:{" "}
                <span className="font-semibold">
                  {formatMoney(summary.totals.savingsWithdrawals)}
                </span>
              </p>
              <p>
                Repayments:{" "}
                <span className="font-semibold">
                  {formatMoney(summary.totals.loanRepayments)}
                </span>
              </p>
              <p>
                Disbursements:{" "}
                <span className="font-semibold">
                  {formatMoney(summary.totals.loanDisbursements)}
                </span>
              </p>
              <p>
                Net cash flow:{" "}
                <span className="font-semibold">
                  {formatMoney(summary.totals.netCashFlow)}
                </span>
              </p>
              <p>
                Audit events:{" "}
                <span className="font-semibold">{summary.auditEvents}</span>
              </p>
            </div>
          </article>
        ))}
      </div>

      <MemberStatementForm members={memberOptions} />

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Recent Audit Logs</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {auditLogs.map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {entry.action}
                </span>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {entry.entity}
                </span>
              </div>
              <p className="mt-2 text-sm">
                Actor: {entry.actor?.fullName ?? entry.actor?.email ?? "System"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Entity ID: {entry.entityId}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No audit logs recorded yet.
            </p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
