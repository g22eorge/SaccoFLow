import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { ReportsService } from "@/src/server/services/reports.service";
import { MembersService } from "@/src/server/services/members.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { MemberStatementForm } from "@/src/ui/forms/member-statement-form";
import { formatMoney } from "@/src/lib/money";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      "CHAIRPERSON",
      "BOARD_MEMBER",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ].includes(role)
  ) {
    redirect("/dashboard");
  }
  const [daily, weekly, monthly, members, settings] = await Promise.all([
    ReportsService.summary("daily", saccoId),
    ReportsService.summary("weekly", saccoId),
    ReportsService.summary("monthly", saccoId),
    MembersService.list({ saccoId, page: 1 }),
    SettingsService.get(saccoId),
  ]);
  const totalShareCapital = await SharesService.getTotalShareCapital(saccoId);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const [shareBalances, savingsBalances] = await Promise.all([
    Promise.all(
      members.map(async (member) => ({
        memberId: member.id,
        balance: await SharesService.getMemberShareBalance(saccoId, member.id),
      })),
    ),
    Promise.all(
      members.map(async (member) => ({
        memberId: member.id,
        balance: await SavingsService.getMemberBalance(saccoId, member.id),
      })),
    ),
  ]);
  const shareBalanceMap = new Map(
    shareBalances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const periodCards = [daily, weekly, monthly];
  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    shareBalance: shareBalanceMap.get(member.id) ?? "0",
  }));
  const memberCount = members.length;

  const totalSavingsPool = savingsBalances.reduce(
    (sum, entry) => sum + Number(entry.balance.toString()),
    0,
  );
  const retainedEarnings = 0;
  const totalEquity = Number(totalShareCapital.toString()) + retainedEarnings;
  const externalCapital = 0;
  const totalCapitalBase = totalEquity + totalSavingsPool + externalCapital;

  const equityShare =
    totalCapitalBase > 0 ? (totalEquity / totalCapitalBase) * 100 : 0;
  const savingsShare =
    totalCapitalBase > 0 ? (totalSavingsPool / totalCapitalBase) * 100 : 0;
  const externalShare =
    totalCapitalBase > 0 ? (externalCapital / totalCapitalBase) * 100 : 0;

  const shareTransactions = await SharesService.list({ saccoId, page: 1 });
  const recentSharePurchases = shareTransactions
    .filter((entry) => entry.eventType === "SHARE_PURCHASE")
    .filter((entry) => new Date(entry.createdAt) >= monthAgo)
    .reduce((sum, entry) => sum + Number(entry.amount.toString()), 0);
  const recentShareRedemptions = shareTransactions
    .filter((entry) => entry.eventType === "SHARE_REDEMPTION")
    .filter((entry) => new Date(entry.createdAt) >= monthAgo)
    .reduce((sum, entry) => sum + Number(entry.amount.toString()), 0);
  const equityMovement30d = recentSharePurchases - recentShareRedemptions;
  const memberPoolMovement30d =
    Number(monthly.totals.savingsDeposits) - Number(monthly.totals.savingsWithdrawals);
  const externalMovement30d = 0;
  const equityOpening = totalEquity - equityMovement30d;
  const savingsOpening = totalSavingsPool - memberPoolMovement30d;
  const externalOpening = externalCapital - externalMovement30d;

  const primaryIncomeStreams = [
    settings.incomeCharges.enableRegistrationFee
      ? {
          label: "Registration fees",
          amount: memberCount * settings.incomeCharges.registrationFee,
        }
      : null,
    settings.incomeCharges.enableLateSavingsPenalty
      ? {
          label: "Penalties on late savings",
          amount: memberCount * settings.incomeCharges.lateSavingsPenalty,
        }
      : null,
    settings.incomeCharges.enableDelayedLoanPenalty
      ? {
          label: "Penalties on delayed loan payments",
          amount: memberCount * settings.incomeCharges.delayedLoanPenalty,
        }
      : null,
    settings.incomeCharges.enableExitCharge
      ? {
          label: "Exit charges",
          amount: Math.floor(memberCount * 0.08) * settings.incomeCharges.exitCharge,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; amount: number }>;

  const additionalIncomeStreams = [
    settings.incomeCharges.enableLoanInterestIncome
      ? {
          label: "Loan interest income",
          amount: memberCount * settings.incomeCharges.loanInterestIncomeAmount,
        }
      : null,
    settings.incomeCharges.enableLoanProcessingFee
      ? {
          label: "Loan processing fees",
          amount: memberCount * settings.incomeCharges.loanProcessingFee,
        }
      : null,
    settings.incomeCharges.enableWithdrawalCharge
      ? {
          label: "Withdrawal charges",
          amount: memberCount * 2 * settings.incomeCharges.withdrawalCharge,
        }
      : null,
    settings.incomeCharges.enableStatementFee
      ? {
          label: "Transfer and statement fees",
          amount: memberCount * settings.incomeCharges.statementFee,
        }
      : null,
    settings.incomeCharges.enableAccountMaintenanceFee
      ? {
          label: "Account maintenance fees",
          amount: memberCount * settings.incomeCharges.accountMaintenanceFee,
        }
      : null,
    settings.incomeCharges.enableInvestmentIncome
      ? {
          label: "Investment income",
          amount: memberCount * settings.incomeCharges.investmentIncomeAmount,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; amount: number }>;

  const incomeRows = [
    {
      stream: "Registration fees",
      category: "Primary",
      enabled: settings.incomeCharges.enableRegistrationFee,
      rate: settings.incomeCharges.registrationFee,
      projected: settings.incomeCharges.enableRegistrationFee
        ? memberCount * settings.incomeCharges.registrationFee
        : 0,
    },
    {
      stream: "Late savings penalties",
      category: "Primary",
      enabled: settings.incomeCharges.enableLateSavingsPenalty,
      rate: settings.incomeCharges.lateSavingsPenalty,
      projected: settings.incomeCharges.enableLateSavingsPenalty
        ? memberCount * settings.incomeCharges.lateSavingsPenalty
        : 0,
    },
    {
      stream: "Delayed loan penalties",
      category: "Primary",
      enabled: settings.incomeCharges.enableDelayedLoanPenalty,
      rate: settings.incomeCharges.delayedLoanPenalty,
      projected: settings.incomeCharges.enableDelayedLoanPenalty
        ? memberCount * settings.incomeCharges.delayedLoanPenalty
        : 0,
    },
    {
      stream: "Exit charges",
      category: "Primary",
      enabled: settings.incomeCharges.enableExitCharge,
      rate: settings.incomeCharges.exitCharge,
      projected: settings.incomeCharges.enableExitCharge
        ? Math.floor(memberCount * 0.08) * settings.incomeCharges.exitCharge
        : 0,
    },
    {
      stream: "Loan interest income",
      category: "Additional",
      enabled: settings.incomeCharges.enableLoanInterestIncome,
      rate: settings.incomeCharges.loanInterestIncomeAmount,
      projected: settings.incomeCharges.enableLoanInterestIncome
        ? memberCount * settings.incomeCharges.loanInterestIncomeAmount
        : 0,
    },
    {
      stream: "Loan processing fees",
      category: "Additional",
      enabled: settings.incomeCharges.enableLoanProcessingFee,
      rate: settings.incomeCharges.loanProcessingFee,
      projected: settings.incomeCharges.enableLoanProcessingFee
        ? memberCount * settings.incomeCharges.loanProcessingFee
        : 0,
    },
    {
      stream: "Withdrawal charges",
      category: "Additional",
      enabled: settings.incomeCharges.enableWithdrawalCharge,
      rate: settings.incomeCharges.withdrawalCharge,
      projected: settings.incomeCharges.enableWithdrawalCharge
        ? memberCount * 2 * settings.incomeCharges.withdrawalCharge
        : 0,
    },
    {
      stream: "Statement fees",
      category: "Additional",
      enabled: settings.incomeCharges.enableStatementFee,
      rate: settings.incomeCharges.statementFee,
      projected: settings.incomeCharges.enableStatementFee
        ? memberCount * settings.incomeCharges.statementFee
        : 0,
    },
    {
      stream: "Account maintenance fees",
      category: "Additional",
      enabled: settings.incomeCharges.enableAccountMaintenanceFee,
      rate: settings.incomeCharges.accountMaintenanceFee,
      projected: settings.incomeCharges.enableAccountMaintenanceFee
        ? memberCount * settings.incomeCharges.accountMaintenanceFee
        : 0,
    },
    {
      stream: "Investment income",
      category: "Additional",
      enabled: settings.incomeCharges.enableInvestmentIncome,
      rate: settings.incomeCharges.investmentIncomeAmount,
      projected: settings.incomeCharges.enableInvestmentIncome
        ? memberCount * settings.incomeCharges.investmentIncomeAmount
        : 0,
    },
  ];

  const operatingIncomeTotal = [...primaryIncomeStreams, ...additionalIncomeStreams].reduce(
    (sum, stream) => sum + stream.amount,
    0,
  );
  const capitalMovementTotal30d =
    equityMovement30d + memberPoolMovement30d + externalMovement30d;
  const monthlyNetCashFlow = Number(monthly.totals.netCashFlow);
  const weeklyRunRate = Number(weekly.totals.netCashFlow) * 4;
  const monthlyDelta = monthlyNetCashFlow - weeklyRunRate;
  const capitalMovementRatio =
    totalCapitalBase > 0 ? (capitalMovementTotal30d / totalCapitalBase) * 100 : 0;

  const trendData = [
    {
      period: "Daily",
      netCashFlow: Number(daily.totals.netCashFlow),
      deposits: Number(daily.totals.savingsDeposits),
      withdrawals: Number(daily.totals.savingsWithdrawals),
    },
    {
      period: "Weekly",
      netCashFlow: Number(weekly.totals.netCashFlow),
      deposits: Number(weekly.totals.savingsDeposits),
      withdrawals: Number(weekly.totals.savingsWithdrawals),
    },
    {
      period: "Monthly",
      netCashFlow: Number(monthly.totals.netCashFlow),
      deposits: Number(monthly.totals.savingsDeposits),
      withdrawals: Number(monthly.totals.savingsWithdrawals),
    },
  ];
  const netCashFlowTarget = 0;

  const enabledIncomeRows = incomeRows.filter((row) => row.enabled);
  const topContributors = [...enabledIncomeRows]
    .sort((a, b) => b.projected - a.projected)
    .slice(0, 3);
  const topDrags = [
    {
      label: "Share redemptions (30d)",
      amount: recentShareRedemptions,
    },
    {
      label: "Savings withdrawals (30d)",
      amount: Number(monthly.totals.savingsWithdrawals),
    },
  ].sort((a, b) => b.amount - a.amount);

  return (
    <>
      <SiteHeader title="Reports" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Reports Center
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Executive Reports</h1>
                  <p className="mt-2 text-muted-foreground">
                    Capital posture, operating income, and period performance in one place.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/settings">Adjust assumptions</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/audit-logs">Open audit logs</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="#member-statements">Member statements</Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Capital Base</p>
                    <p className="mt-1 text-2xl font-bold">{formatMoney(totalCapitalBase)}</p>
                    <p className={`mt-1 text-xs ${capitalMovementRatio >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      30d movement: {formatMoney(capitalMovementTotal30d)} ({capitalMovementRatio.toFixed(1)}%)
                    </p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected Operating Income</p>
                    <p className="mt-1 text-2xl font-bold">{formatMoney(operatingIncomeTotal)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Active streams: {incomeRows.filter((row) => row.enabled).length}</p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Net Cashflow</p>
                    <p className="mt-1 text-2xl font-bold">{formatMoney(monthlyNetCashFlow)}</p>
                    <p className={`mt-1 text-xs ${monthlyDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      vs weekly run-rate: {formatMoney(monthlyDelta)}
                    </p>
                  </article>
                  <article className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">30d Capital Movement</p>
                    <p className="mt-1 text-2xl font-bold">{formatMoney(capitalMovementTotal30d)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Equity + savings + external</p>
                  </article>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Capital & Equity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Source mix and 30 day bridge from opening to closing balances.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total equity</p>
                        <p className="mt-1 text-lg font-semibold">{formatMoney(totalEquity)}</p>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Savings pool</p>
                        <p className="mt-1 text-lg font-semibold">{formatMoney(totalSavingsPool)}</p>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">External capital</p>
                        <p className="mt-1 text-lg font-semibold">{formatMoney(externalCapital)}</p>
                      </article>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>Equity</span>
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
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <article className="rounded-md border bg-background px-4 py-3 md:col-span-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Capital Bridge (30d)</p>
                        <div className="mt-3 overflow-hidden rounded-md border">
                          <Table>
                            <TableHeader className="bg-muted/60">
                              <TableRow>
                                <TableHead>Source</TableHead>
                                <TableHead>Opening</TableHead>
                                <TableHead>Movement</TableHead>
                                <TableHead>Closing</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Equity</TableCell>
                                <TableCell>{formatMoney(equityOpening)}</TableCell>
                                <TableCell className={equityMovement30d >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {formatMoney(equityMovement30d)}
                                </TableCell>
                                <TableCell>{formatMoney(totalEquity)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Member Savings Pool</TableCell>
                                <TableCell>{formatMoney(savingsOpening)}</TableCell>
                                <TableCell className={memberPoolMovement30d >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {formatMoney(memberPoolMovement30d)}
                                </TableCell>
                                <TableCell>{formatMoney(totalSavingsPool)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>External Capital</TableCell>
                                <TableCell>{formatMoney(externalOpening)}</TableCell>
                                <TableCell className={externalMovement30d >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {formatMoney(externalMovement30d)}
                                </TableCell>
                                <TableCell>{formatMoney(externalCapital)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Equity movement is net share purchases minus redemptions in the last 30 days.
                        </p>
                      </article>
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Operating Income Streams</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Fee and lending revenue projections based on {memberCount} members.
                    </p>
                    <div className="mt-4 overflow-hidden rounded-lg border bg-background">
                      <Table>
                        <TableHeader className="bg-muted/60">
                          <TableRow>
                            <TableHead>Stream</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Enabled</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Projected</TableHead>
                            <TableHead>Share %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incomeRows.map((row) => {
                            const sharePercent =
                              operatingIncomeTotal > 0 ? (row.projected / operatingIncomeTotal) * 100 : 0;
                            return (
                              <TableRow key={row.stream}>
                                <TableCell>{row.stream}</TableCell>
                                <TableCell>{row.category}</TableCell>
                                <TableCell>{row.enabled ? "Yes" : "No"}</TableCell>
                                <TableCell>{formatMoney(row.rate)}</TableCell>
                                <TableCell>{formatMoney(row.projected)}</TableCell>
                                <TableCell>{sharePercent.toFixed(1)}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Trend Overview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Net cash flow trend with benchmark and savings movement context.
                  </p>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-md border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Trend Bars</p>
                      <p className="mt-1 text-xs text-muted-foreground">Benchmark target: {formatMoney(netCashFlowTarget)}</p>
                      <div className="mt-4 space-y-3">
                        {trendData.map((point) => {
                          const max = Math.max(
                            ...trendData.map((p) => Math.abs(p.netCashFlow)),
                            1,
                          );
                          const width = `${(Math.abs(point.netCashFlow) / max) * 100}%`;
                          const tone = point.netCashFlow >= 0 ? "bg-emerald-500" : "bg-red-500";
                          return (
                            <div key={point.period}>
                              <div className="mb-1 flex items-center justify-between text-sm">
                                <span>{point.period}</span>
                                <span className={point.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {formatMoney(point.netCashFlow)}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-muted">
                                <div className={`h-2 rounded-full ${tone}`} style={{ width }} />
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Deposits: {formatMoney(point.deposits)} | Withdrawals: {formatMoney(point.withdrawals)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Contributors</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {topContributors.map((item) => (
                            <li key={item.stream} className="flex items-center justify-between">
                              <span>{item.stream}</span>
                              <span className="font-semibold">{formatMoney(item.projected)}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                      <article className="rounded-md border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Drags</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {topDrags.map((item) => (
                            <li key={item.label} className="flex items-center justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold text-red-600">-{formatMoney(item.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Period Performance</h2>
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {periodCards.map((summary) => {
                      const baseline =
                        summary.period === "monthly"
                          ? Number(weekly.totals.netCashFlow) * 4
                          : summary.period === "weekly"
                            ? Number(daily.totals.netCashFlow) * 7
                            : Number(weekly.totals.netCashFlow) / 7;
                      const delta = Number(summary.totals.netCashFlow) - baseline;

                      return (
                        <div key={summary.period} className="rounded-lg border bg-background p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {periodLabels[summary.period]} | {new Date(summary.window.start).toLocaleString()} -{" "}
                              {new Date(summary.window.end).toLocaleString()}
                            </p>
                            <span className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              vs prior-equivalent: {formatMoney(delta)}
                            </span>
                          </div>
                          <div className="mt-3 overflow-hidden rounded-md border">
                            <Table>
                              <TableBody>
                                <TableRow><TableCell>Members</TableCell><TableCell>{summary.memberCount}</TableCell></TableRow>
                                <TableRow><TableCell>New members</TableCell><TableCell>{summary.memberJoinedCount}</TableCell></TableRow>
                                <TableRow><TableCell>Active loans</TableCell><TableCell>{summary.activeLoans}</TableCell></TableRow>
                                <TableRow><TableCell>Loan applications</TableCell><TableCell>{summary.loanAppliedCount}</TableCell></TableRow>
                                <TableRow><TableCell>Savings deposits</TableCell><TableCell>{formatMoney(summary.totals.savingsDeposits)}</TableCell></TableRow>
                                <TableRow><TableCell>Savings withdrawals</TableCell><TableCell>{formatMoney(summary.totals.savingsWithdrawals)}</TableCell></TableRow>
                                <TableRow><TableCell>Loan repayments</TableCell><TableCell>{formatMoney(summary.totals.loanRepayments)}</TableCell></TableRow>
                                <TableRow><TableCell>Loan disbursements</TableCell><TableCell>{formatMoney(summary.totals.loanDisbursements)}</TableCell></TableRow>
                                <TableRow><TableCell>Net cash flow</TableCell><TableCell>{formatMoney(summary.totals.netCashFlow)}</TableCell></TableRow>
                                <TableRow><TableCell>Audit events</TableCell><TableCell>{summary.auditEvents}</TableCell></TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section id="member-statements">
                  <MemberStatementForm members={memberOptions} />
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
