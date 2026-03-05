import { requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SharesService } from "@/src/server/services/shares.service";
import { ShareTransactionForm } from "@/src/ui/forms/share-transaction-form";
import { SharesTransactionsPanel } from "@/src/ui/components/shares-transactions-panel";
import { formatMoney } from "@/src/lib/money";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { redirect } from "next/navigation";

const signalTone = (status: "Strong" | "Watch" | "Critical") =>
  status === "Strong"
    ? "text-emerald-700 bg-emerald-50"
    : status === "Watch"
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";

export default async function SharesPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const { saccoId, role } = await requireSaccoContext();
  if (
    !["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "AUDITOR", "LOAN_OFFICER"].includes(role)
  ) {
    redirect("/dashboard");
  }
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const members = await MembersService.list({ saccoId, page: 1 });
  const [shareBalances, shareCapitalTotal, transactions] = await Promise.all([
    Promise.all(
      members.map(async (member) => ({
        memberId: member.id,
        balance: await SharesService.getMemberShareBalance(saccoId, member.id),
      })),
    ),
    SharesService.getTotalShareCapital(saccoId),
    SharesService.list({
      saccoId,
      page,
    }),
  ]);
  const hasNextPage = transactions.length === 30;

  const memberCount = members.length;
  const totalShareCapitalNumber = Number(shareCapitalTotal.toString());
  const membersWithShares = shareBalances.filter((entry) => entry.balance.gt(0)).length;
  const shareParticipation =
    memberCount > 0 ? (membersWithShares / memberCount) * 100 : 0;
  const averageSharePerMember =
    memberCount > 0 ? Number(shareCapitalTotal.toString()) / memberCount : 0;

  const purchases = transactions
    .filter((entry) => entry.eventType === "SHARE_PURCHASE")
    .reduce((sum, entry) => sum + Number(entry.amount.toString()), 0);
  const redemptions = transactions
    .filter((entry) => entry.eventType === "SHARE_REDEMPTION")
    .reduce((sum, entry) => sum + Number(entry.amount.toString()), 0);
  const adjustments = transactions
    .filter((entry) => entry.eventType === "SHARE_ADJUSTMENT")
    .reduce((sum, entry) => sum + Number(entry.amount.toString()), 0);
  const netMovement = purchases - redemptions + adjustments;
  const purchaseCount = transactions.filter(
    (entry) => entry.eventType === "SHARE_PURCHASE",
  ).length;
  const redemptionCount = transactions.filter(
    (entry) => entry.eventType === "SHARE_REDEMPTION",
  ).length;
  const redemptionPressure = purchases > 0 ? (redemptions / purchases) * 100 : 0;
  const equityVelocity =
    totalShareCapitalNumber > 0 ? (netMovement / totalShareCapitalNumber) * 100 : 0;

  const holderRows = shareBalances
    .map((entry) => {
      const member = members.find((item) => item.id === entry.memberId);
      const balance = Number(entry.balance.toString());
      return {
        memberId: entry.memberId,
        label: member
          ? `${member.memberNumber} - ${member.fullName}`
          : entry.memberId,
        balance,
      };
    })
    .sort((a, b) => b.balance - a.balance);
  const topHolders = holderRows.slice(0, 5);
  const topHolderConcentration =
    totalShareCapitalNumber > 0
      ? (topHolders.reduce((sum, row) => sum + row.balance, 0) /
          totalShareCapitalNumber) *
        100
      : 0;

  const decisionSignals = [
    {
      name: "Share Participation",
      value: `${shareParticipation.toFixed(1)}%`,
      target: ">= 60%",
      status:
        shareParticipation >= 60
          ? ("Strong" as const)
          : shareParticipation >= 45
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Redemption Pressure",
      value: `${redemptionPressure.toFixed(1)}%`,
      target: "<= 40% of purchases",
      status:
        redemptionPressure <= 40
          ? ("Strong" as const)
          : redemptionPressure <= 65
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Top-5 Concentration",
      value: `${topHolderConcentration.toFixed(1)}%`,
      target: "<= 55%",
      status:
        topHolderConcentration <= 55
          ? ("Strong" as const)
          : topHolderConcentration <= 70
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Equity Velocity",
      value: `${equityVelocity.toFixed(1)}%`,
      target: ">= 0%",
      status:
        equityVelocity >= 0
          ? ("Strong" as const)
          : equityVelocity >= -3
            ? ("Watch" as const)
            : ("Critical" as const),
    },
  ];

  const scenarioCards = [
    {
      label: "Base Case",
      impact: 0,
      projectedCapital: totalShareCapitalNumber,
    },
    {
      label: "10% Redemption Shock",
      impact: -(totalShareCapitalNumber * 0.1),
      projectedCapital: totalShareCapitalNumber * 0.9,
    },
    {
      label: "Participation +5%",
      impact: averageSharePerMember * Math.ceil(memberCount * 0.05),
      projectedCapital:
        totalShareCapitalNumber +
        averageSharePerMember * Math.ceil(memberCount * 0.05),
    },
  ];

  const actionQueue = [
    shareParticipation < 60
      ? {
          title: "Raise member share participation",
          detail: `${(60 - shareParticipation).toFixed(1)}pp gap to participation target`,
        }
      : null,
    redemptionPressure > 40
      ? {
          title: "Review redemption trend",
          detail: `Redemption pressure at ${redemptionPressure.toFixed(1)}% is above target`,
        }
      : null,
    topHolderConcentration > 55
      ? {
          title: "Diversify share ownership",
          detail: `Top-5 concentration is ${topHolderConcentration.toFixed(1)}%`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string }>;

  const balanceMap = new Map(
    shareBalances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );
  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    shareBalance: balanceMap.get(member.id) ?? "0",
  }));

  const transactionRows = transactions.map((entry) => ({
    id: entry.id,
    memberLabel: entry.member
      ? `${entry.member.memberNumber} - ${entry.member.fullName}`
      : entry.memberId ?? "Unknown member",
    type:
      entry.eventType === "SHARE_PURCHASE"
        ? ("PURCHASE" as const)
        : entry.eventType === "SHARE_REDEMPTION"
          ? ("REDEMPTION" as const)
          : ("ADJUSTMENT" as const),
    amount: entry.amount.toString(),
    note: entry.reference,
    createdAt: entry.createdAt.toISOString(),
  }));

  return (
    <>
      <SiteHeader title="Shares" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                        Capital Ledger
                      </p>
                      <h1 className="mt-2 text-2xl font-bold">Shares</h1>
                      <p className="mt-2 text-muted-foreground">
                        Track share capital growth, redemptions, and member equity activity.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {new Date().toLocaleString()} | Page {page}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/api/shares/export?format=csv&page=${page}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export CSV
                      </Link>
                      <Link
                        href={`/api/shares/export?format=pdf&page=${page}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export PDF
                      </Link>
                    </div>
                  </div>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Share Capital</p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatMoney(shareCapitalTotal.toString())}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Avg/member: {formatMoney(averageSharePerMember)}
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Share Participation</p>
                      <p className="mt-1 text-2xl font-bold">{shareParticipation.toFixed(1)}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Members with shares: {membersWithShares}
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Movement</p>
                      <p
                        className={`mt-1 text-2xl font-bold ${
                          netMovement >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatMoney(netMovement)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Purchases - redemptions + adjustments
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchases</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700">
                        {formatMoney(purchases)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Latest page totals</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Redemptions</p>
                      <p className="mt-1 text-2xl font-bold text-red-700">
                        {formatMoney(redemptions)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Latest page totals</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Adjustments</p>
                      <p className="mt-1 text-2xl font-bold">{formatMoney(adjustments)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Transactions loaded: {transactions.length} ({purchaseCount} purchases, {redemptionCount} redemptions)
                      </p>
                    </article>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Executive Signals</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Decision markers for equity health and ownership quality.
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
                    <h2 className="text-lg font-semibold">Top Share Holders</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Concentration view across highest equity contributors.
                    </p>
                    <div className="mt-4 space-y-2">
                      {topHolders.map((holder) => {
                        const holderShare =
                          totalShareCapitalNumber > 0
                            ? (holder.balance / totalShareCapitalNumber) * 100
                            : 0;
                        return (
                          <article
                            key={holder.memberId}
                            className="rounded-md border bg-background px-4 py-3"
                          >
                            <p className="text-sm font-medium">{holder.label}</p>
                            <div className="mt-1 flex items-center justify-between text-sm">
                              <span className="font-semibold">
                                {formatMoney(holder.balance)}
                              </span>
                              <span className="text-muted-foreground">
                                {holderShare.toFixed(1)}%
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Top-5 concentration: {topHolderConcentration.toFixed(1)}%
                    </p>
                  </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Scenario Outlook</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Quick stress checks for capital planning conversations.
                    </p>
                    <div className="mt-4 space-y-3">
                      {scenarioCards.map((scenario) => (
                        <article
                          key={scenario.label}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <p className="text-sm font-medium">{scenario.label}</p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatMoney(scenario.projectedCapital)}
                          </p>
                          <p
                            className={`text-xs ${
                              scenario.impact >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            Impact: {formatMoney(scenario.impact)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Priority Actions</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Current recommendations based on share-capital signals.
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
                          </article>
                        ))
                      ) : (
                        <article className="rounded-md border bg-background px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-700">
                            No immediate intervention flags.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Share performance is within current policy thresholds.
                          </p>
                        </article>
                      )}
                    </div>
                  </section>
                </div>

                <ShareTransactionForm members={memberOptions} />
                <SharesTransactionsPanel transactions={transactionRows} />

                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={page > 1 ? `/dashboard/shares?page=${page - 1}` : "#"}
                      className={`text-sm ${page > 1 ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Previous
                    </Link>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Link
                      href={hasNextPage ? `/dashboard/shares?page=${page + 1}` : "#"}
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
