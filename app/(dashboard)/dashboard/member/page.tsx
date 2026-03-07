import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { SavingsService } from "@/src/server/services/savings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { MembersService } from "@/src/server/services/members.service";
import { LoansService } from "@/src/server/services/loans.service";
import { LoanProductsService } from "@/src/server/services/loan-products.service";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { MemberSelfService } from "@/src/ui/components/member-self-service";
import { formatMemberLabel } from "@/src/lib/member-label";

const loanStatusChipClass = (status: string) => {
  if (status === "ACTIVE" || status === "DISBURSED") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "PENDING" || status === "APPROVED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "CLEARED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "DEFAULTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-border bg-background text-foreground";
};

export default async function MemberDashboardPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (role !== "MEMBER") {
    redirect("/dashboard");
  }

  const session = await getSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    redirect("/sign-in");
  }

  const appUser = await prisma.appUser.findFirst({
    where: { saccoId, email },
    select: { fullName: true },
  });

  let member = await prisma.member.findFirst({
    where: {
      saccoId,
      email,
    },
  });

  if (!member && appUser?.fullName) {
    member = await prisma.member.findFirst({
      where: {
        saccoId,
        fullName: appUser.fullName,
      },
    });
  }

  if (!member) {
    const memberNumber = await MembersService.generateNextMemberNumber(saccoId);
    member = await prisma.member.create({
      data: {
        saccoId,
        memberNumber,
        fullName: formatMemberLabel(
          memberNumber,
          appUser?.fullName ?? email.split("@")[0],
        ),
        email,
        status: "ACTIVE",
      },
    });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    savingsBalance,
    shareBalance,
    loans,
    recentDeposits,
    deposits30d,
    pendingLoanRequests,
    memberRequestStatusLogs,
    depositsPrevious30d,
    loanProducts,
  ] = await Promise.all([
    SavingsService.getMemberBalance(saccoId, member.id),
    SharesService.getMemberShareBalance(saccoId, member.id),
    prisma.loan.findMany({
      where: { saccoId, memberId: member.id },
      orderBy: { appliedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        termMonths: true,
        principalAmount: true,
        interestAmount: true,
        outstandingPrincipal: true,
        outstandingInterest: true,
        outstandingPenalty: true,
        appliedAt: true,
        dueAt: true,
      },
    }),
    prisma.savingsTransaction.findMany({
      where: {
        saccoId,
        memberId: member.id,
        type: "DEPOSIT",
      },
      orderBy: { createdAt: "desc" },
      take: 6,
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
    prisma.loan.count({
      where: {
        saccoId,
        memberId: member.id,
        status: "PENDING",
      },
    }),
    prisma.auditLog.findMany({
      where: {
        saccoId,
        entity: "MemberRequest",
        entityId: { startsWith: `${member.id}:` },
      },
      select: {
        afterJson: true,
      },
    }),
    prisma.savingsTransaction.aggregate({
      where: {
        saccoId,
        memberId: member.id,
        type: "DEPOSIT",
        createdAt: {
          gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: thirtyDaysAgo,
        },
      },
      _sum: { amount: true },
    }),
    LoanProductsService.list(saccoId),
  ]);

  const requestLogs = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "MemberRequest",
      entityId: { startsWith: `${member.id}:` },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const requests = requestLogs.map((log) => {
    const after = log.afterJson ? JSON.parse(log.afterJson) : {};
    return {
      id: log.id,
      type: String(after.type ?? "REQUEST"),
      amount: String(after.amount ?? "0"),
      status: String(after.status ?? "PENDING"),
      note: typeof after.note === "string" ? after.note : null,
      createdAt: log.createdAt.toISOString(),
    };
  });

  const pendingMemberRequests = memberRequestStatusLogs.reduce((count, log) => {
    if (!log.afterJson) {
      return count;
    }

    try {
      const payload = JSON.parse(log.afterJson) as { status?: unknown };
      return payload.status === "PENDING" ? count + 1 : count;
    } catch {
      return count;
    }
  }, 0);

  const outstanding = loans.reduce(
    (sum, loan) => sum + Number(loan.outstandingPrincipal.toString()),
    0,
  );
  const nextDueLoan = loans
    .filter((loan) => loan.dueAt)
    .sort((a, b) => (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];

  const depositCurrent30d = Number((deposits30d._sum.amount ?? 0).toString());
  const depositPrevious30d = Number((depositsPrevious30d._sum.amount ?? 0).toString());
  const depositDelta = depositCurrent30d - depositPrevious30d;
  const depositTrendLabel =
    depositDelta > 0 ? "Up vs previous 30 days" : depositDelta < 0 ? "Down vs previous 30 days" : "Flat vs previous 30 days";
  const depositTrendTone = depositDelta > 0 ? "text-emerald-700" : depositDelta < 0 ? "text-red-700" : "text-muted-foreground";

  const scheduleApprovals = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "LoanScheduleApproval",
      entityId: { endsWith: `:${member.id}` },
    },
    select: {
      entityId: true,
    },
  });

  const approvedScheduleLoanIds = new Set(
    scheduleApprovals.map((entry) => entry.entityId.split(":")[0]),
  );

  const loansPendingScheduleApproval = await Promise.all(
    loans
      .filter((loan) => loan.status === "APPROVED" && !approvedScheduleLoanIds.has(loan.id))
      .map(async (loan) => ({
        id: loan.id,
        principalAmount: loan.principalAmount.toString(),
        interestAmount: loan.interestAmount.toString(),
        termMonths: loan.termMonths,
        schedule: await LoansService.getSchedule({
          id: loan.id,
          appliedAt: loan.appliedAt,
          termMonths: loan.termMonths,
          principalAmount: loan.principalAmount,
          interestAmount: loan.interestAmount,
        }),
      })),
  );

  return (
    <>
      <SiteHeader title="My Dashboard" />
      <div className="p-6">
        <section className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
              Member View
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              Welcome, {formatMemberLabel(member.memberNumber, member.fullName)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your personal balances and latest loan activity.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Signed in: {email} | Member No: {member.memberNumber}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Savings Balance</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(savingsBalance.toString())}</p>
            </article>
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Share Balance</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(shareBalance.toString())}</p>
            </article>
            <article className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Loan Outstanding</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(outstanding)}</p>
            </article>
          </div>

          <section className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">My Watchlist</h2>
              <p className="text-xs text-muted-foreground">Requests and decisions that need follow-up</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Loan Applications</p>
                <p className="mt-1 text-2xl font-bold">{pendingLoanRequests}</p>
                <p className="mt-1 text-xs text-muted-foreground">Awaiting credit review and approval outcome.</p>
                <Link href="/dashboard/member#recent-loans" className="mt-2 inline-block text-xs text-[#cc5500]">
                  View recent loans
                </Link>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Service Requests</p>
                <p className="mt-1 text-2xl font-bold">{pendingMemberRequests}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Savings withdrawals and share redemptions pending review.
                </p>
                <Link href="/dashboard/member#self-service" className="mt-2 inline-block text-xs text-[#cc5500]">
                  Open self-service
                </Link>
              </article>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Last updated: {formatDateTimeUtc(new Date())}</p>
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Repayment Calendar</h2>
            {nextDueLoan ? (
              <div className="mt-3 rounded-md border bg-background px-4 py-3">
                <p className="text-sm font-medium">Next due date: {formatDateTimeUtc(nextDueLoan.dueAt as Date)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep repayments on schedule to avoid penalty buildup.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed bg-background px-4 py-4">
                <p className="text-sm font-medium">No upcoming due date available.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submit a new application in self-service if you need financing.
                </p>
                <Link href="/dashboard/member#self-service" className="mt-2 inline-block text-xs text-[#cc5500]">
                  Go to self-service
                </Link>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Last updated: {formatDateTimeUtc(new Date())}</p>
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Deposit Tracking</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your posted deposits and contribution consistency.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Deposits (30 days)</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatMoney((deposits30d._sum.amount ?? 0).toString())}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deposits30d._count._all} transactions
                </p>
                <p className={`mt-1 text-xs ${depositTrendTone}`}>
                  {depositTrendLabel}: {depositDelta >= 0 ? "+" : ""}{formatMoney(depositDelta)}
                </p>
              </article>
              <article className="rounded-md border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest Deposit</p>
                <p className="mt-1 text-sm font-semibold">
                  {recentDeposits[0]
                    ? formatMoney(recentDeposits[0].amount.toString())
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recentDeposits[0]
                    ? formatDateTimeUtc(recentDeposits[0].createdAt)
                    : "No deposit yet"}
                </p>
              </article>
            </div>
            <div className="mt-4 space-y-2">
              {recentDeposits.map((deposit) => (
                <article key={deposit.id} className="rounded-md border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{formatMoney(deposit.amount.toString())}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeUtc(deposit.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deposit.note ?? "Deposit"}
                  </p>
                </article>
              ))}
              {recentDeposits.length === 0 ? (
                <article className="rounded-md border border-dashed bg-background px-4 py-4">
                  <p className="text-sm font-medium">No deposits posted yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your contributions appear here after posting.
                  </p>
                </article>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Last updated: {formatDateTimeUtc(new Date())}</p>
          </section>

          <section id="recent-loans" className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Recent Loans</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {loans.map((loan) => (
                <article key={loan.id} className="rounded-md border bg-background px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${loanStatusChipClass(loan.status)}`}>
                      {loan.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTimeUtc(loan.appliedAt)}</span>
                  </div>
                  <p className="mt-2 text-sm">Principal: {formatMoney(loan.principalAmount.toString())}</p>
                  <p className="mt-1 text-sm">
                    Outstanding: {formatMoney((
                      Number(loan.outstandingPrincipal.toString()) +
                      Number(loan.outstandingInterest.toString()) +
                      Number(loan.outstandingPenalty.toString())
                    ).toString())}
                  </p>
                </article>
              ))}
              {loans.length === 0 ? (
                <article className="rounded-md border border-dashed bg-background px-4 py-4 md:col-span-2">
                  <p className="text-sm font-medium">No loan records found.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Apply from self-service to start your loan history.
                  </p>
                  <Link href="/dashboard/member#self-service" className="mt-2 inline-block text-xs text-[#cc5500]">
                    Submit loan request
                  </Link>
                </article>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Last updated: {formatDateTimeUtc(new Date())}</p>
          </section>

          <section id="self-service">
            <MemberSelfService
              requests={requests}
              loansPendingScheduleApproval={loansPendingScheduleApproval}
              loanProducts={loanProducts.map((product) => ({
                id: product.id,
                name: product.name,
                minPrincipal: product.minPrincipal.toString(),
                maxPrincipal: product.maxPrincipal.toString(),
                minTermMonths: product.minTermMonths,
                maxTermMonths: product.maxTermMonths,
                repaymentFrequency: product.repaymentFrequency,
              }))}
            />
          </section>
        </section>
      </div>
    </>
  );
}
