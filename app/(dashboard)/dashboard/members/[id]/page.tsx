import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { SavingsService } from "@/src/server/services/savings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { MemberRequestsAdminPanel } from "@/src/ui/components/member-requests-admin-panel";

export default async function MemberSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { saccoId, role } = await requireSaccoContext();

  if (
    ![
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "CHAIRPERSON",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
      "BOARD_MEMBER",
    ].includes(role)
  ) {
    redirect("/dashboard");
  }

  const member = await prisma.member.findFirst({
    where: { id, saccoId },
  });

  if (!member) {
    redirect("/dashboard/members");
  }

  const [savingsBalance, shareBalance, loans, repayments] = await Promise.all([
    SavingsService.getMemberBalance(saccoId, member.id),
    SharesService.getMemberShareBalance(saccoId, member.id),
    prisma.loan.findMany({
      where: { saccoId, memberId: member.id },
      orderBy: { appliedAt: "desc" },
      take: 8,
    }),
    prisma.loanRepayment.findMany({
      where: { saccoId, memberId: member.id },
      orderBy: { paidAt: "desc" },
      take: 8,
    }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [recentDeposits, deposits30dTotal, deposits90dTotal, depositsLifetimeTotal] =
    await Promise.all([
      prisma.savingsTransaction.findMany({
        where: {
          saccoId,
          memberId: member.id,
          type: "DEPOSIT",
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId,
          memberId: member.id,
          type: "DEPOSIT",
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId,
          memberId: member.id,
          type: "DEPOSIT",
          createdAt: { gte: ninetyDaysAgo },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          saccoId,
          memberId: member.id,
          type: "DEPOSIT",
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

  const lastDepositAt = recentDeposits[0]?.createdAt ?? null;
  const avgDeposit30d =
    (deposits30dTotal._count._all ?? 0) > 0
      ? Number(deposits30dTotal._sum.amount ?? 0) / deposits30dTotal._count._all
      : 0;

  const requestLogs = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "MemberRequest",
      entityId: { startsWith: `${member.id}:` },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const requests = requestLogs.map((log) => {
    const after = log.afterJson ? JSON.parse(log.afterJson) : {};
    return {
      id: log.id,
      type: String(after.type ?? "REQUEST"),
      amount: String(after.amount ?? "0"),
      status: String(after.status ?? "PENDING"),
      note: typeof after.note === "string" ? after.note : null,
      reviewNote: typeof after.reviewNote === "string" ? after.reviewNote : null,
      createdAt: log.createdAt.toISOString(),
      reviewedAt:
        typeof after.reviewedAt === "string" ? after.reviewedAt : null,
    };
  });

  const canReview = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"].includes(role);

  const outstandingPrincipal = loans.reduce(
    (sum, loan) => sum + Number(loan.outstandingPrincipal.toString()),
    0,
  );
  const outstandingInterest = loans.reduce(
    (sum, loan) => sum + Number(loan.outstandingInterest.toString()),
    0,
  );
  const outstandingPenalty = loans.reduce(
    (sum, loan) => sum + Number(loan.outstandingPenalty.toString()),
    0,
  );
  const repaidTotal = repayments.reduce(
    (sum, repayment) => sum + Number(repayment.amount.toString()),
    0,
  );

  const pendingRequestsCount = requests.filter(
    (request) => request.status === "PENDING",
  ).length;
  const approvedRequestsCount = requests.filter(
    (request) => request.status === "APPROVED",
  ).length;
  const rejectedRequestsCount = requests.filter(
    (request) => request.status === "REJECTED",
  ).length;

  const defaultedLoansCount = loans.filter(
    (loan) => loan.status === "DEFAULTED",
  ).length;
  const overdueLoansCount = loans.filter(
    (loan) => loan.dueAt && loan.dueAt.getTime() < now.getTime() && ["ACTIVE", "DISBURSED", "DEFAULTED"].includes(loan.status),
  ).length;
  const hasRepaymentHistory = repayments.length >= 3;
  const hasSavingsConsistency = (deposits30dTotal._count._all ?? 0) >= 2;

  let trustScore = 100;
  if (!hasRepaymentHistory) {
    trustScore -= 12;
  }
  if (!hasSavingsConsistency) {
    trustScore -= 10;
  }
  if (overdueLoansCount > 0) {
    trustScore -= Math.min(25, overdueLoansCount * 10);
  }
  if (defaultedLoansCount > 0) {
    trustScore -= Math.min(40, defaultedLoansCount * 20);
  }
  trustScore = Math.max(0, Math.min(100, trustScore));

  const trustTier = trustScore >= 80 ? "GREEN" : trustScore >= 60 ? "AMBER" : "RED";
  const relationshipValue =
    Number((depositsLifetimeTotal._sum.amount ?? 0).toString()) +
    Number(shareBalance.toString()) +
    repaidTotal;

  return (
    <>
      <SiteHeader title="Member Snapshot" />
      <div className="p-6">
        <section className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                  Financial Snapshot
                </p>
                <h1 className="mt-2 text-2xl font-bold">{member.fullName}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {member.memberNumber} {member.email ? `| ${member.email}` : ""}
                </p>
              </div>
              <Link
                href="/dashboard/members"
                className="rounded-md border border-border px-3 py-1.5 text-sm"
              >
                Back to Members
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Savings Balance</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(savingsBalance.toString())}</p>
            </article>
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Shares Balance</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(shareBalance.toString())}</p>
            </article>
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Loan Outstanding</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(outstandingPrincipal + outstandingInterest + outstandingPenalty)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Principal {formatMoney(outstandingPrincipal)}
              </p>
            </article>
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent Repaid</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(repaidTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">From latest {repayments.length} repayments</p>
            </article>
          </div>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Member 360 Risk & Relationship</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Trust posture, service behavior, and relationship value in one view.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Trust Score</p>
                <p className="mt-1 text-xl font-semibold">{trustScore}/100</p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Trust Tier</p>
                <p className="mt-1 text-xl font-semibold">{trustTier}</p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Relationship Value</p>
                <p className="mt-1 text-xl font-semibold">{formatMoney(relationshipValue)}</p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Service Requests</p>
                <p className="mt-1 text-xl font-semibold">{pendingRequestsCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved {approvedRequestsCount} | Rejected {rejectedRequestsCount}
                </p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Credit Flags</p>
                <p className="mt-1 text-xl font-semibold">{overdueLoansCount + defaultedLoansCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Overdue {overdueLoansCount} | Defaulted {defaultedLoansCount}
                </p>
              </article>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold">Loan Timeline</h2>
              <div className="mt-3 space-y-2">
                {loans.map((loan) => (
                  <article key={loan.id} className="rounded-md border bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{loan.status}</p>
                      <p className="text-xs text-muted-foreground">Applied {formatDateTimeUtc(loan.appliedAt)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Principal {formatMoney(loan.principalAmount.toString())} | Outstanding {formatMoney((Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest) + Number(loan.outstandingPenalty)).toString())}
                    </p>
                  </article>
                ))}
                {loans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No loans found for this member.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold">Repayment History</h2>
              <div className="mt-3 space-y-2">
                {repayments.map((repayment) => (
                  <article key={repayment.id} className="rounded-md border bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{formatMoney(repayment.amount.toString())}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTimeUtc(repayment.paidAt)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{repayment.note ?? "Repayment"}</p>
                  </article>
                ))}
                {repayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No repayments found.</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Deposit Activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Posted deposit trends and consistency for this member.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Deposits 30D</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatMoney((deposits30dTotal._sum.amount ?? 0).toString())}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deposits30dTotal._count._all} transactions
                </p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Deposits 90D</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatMoney((deposits90dTotal._sum.amount ?? 0).toString())}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deposits90dTotal._count._all} transactions
                </p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime Deposits</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatMoney((depositsLifetimeTotal._sum.amount ?? 0).toString())}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {depositsLifetimeTotal._count._all} transactions
                </p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Average 30D Deposit</p>
                <p className="mt-1 text-xl font-semibold">{formatMoney(avgDeposit30d)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last deposit: {lastDepositAt ? formatDateTimeUtc(lastDepositAt) : "No deposits"}
                </p>
              </article>
            </div>

            <div className="mt-4 space-y-2">
              {recentDeposits.map((deposit) => (
                <article key={deposit.id} className="rounded-md border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{formatMoney(deposit.amount.toString())}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTimeUtc(deposit.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{deposit.note ?? "Deposit"}</p>
                </article>
              ))}
              {recentDeposits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deposit history found for this member.</p>
              ) : null}
            </div>
          </section>

          <MemberRequestsAdminPanel requests={requests} canReview={canReview} />
        </section>
      </div>
    </>
  );
}
