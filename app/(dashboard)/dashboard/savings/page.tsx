import { requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { SavingsTransactionForm } from "@/src/ui/forms/savings-transaction-form";
import { SavingsTransactionsPanel } from "@/src/ui/components/savings-transactions-panel";
import { formatMoney } from "@/src/lib/money";
import { SiteHeader } from "@/components/site-header";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SavingsPage({
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
  const transactions = await SavingsService.list({ saccoId, page });
  const hasNextPage = transactions.length === 30;
  const [balances, shareBalances] = await Promise.all([
    Promise.all(
      members.map(async (member) => ({
        memberId: member.id,
        balance: await SavingsService.getMemberBalance(saccoId, member.id),
      })),
    ),
    Promise.all(
      members.map(async (member) => ({
        memberId: member.id,
        balance: await SharesService.getMemberShareBalance(saccoId, member.id),
      })),
    ),
  ]);

  const memberMap = new Map(
    members.map((member) => [
      member.id,
      `${member.memberNumber} - ${member.fullName}`,
    ]),
  );
  const balanceMap = new Map(
    balances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );
  const shareBalanceMap = new Map(
    shareBalances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    balance: balanceMap.get(member.id) ?? "0",
    shareBalance: shareBalanceMap.get(member.id) ?? "0",
  }));

  const totalMembers = members.length;
  const activeMembers = members.filter((member) => member.status === "ACTIVE").length;
  const totalSavingsPool = balances.reduce(
    (sum, entry) => sum.plus(entry.balance),
    new Prisma.Decimal(0),
  );
  const membersWithSavings = balances.filter((entry) => entry.balance.gt(0)).length;
  const savingsParticipation =
    totalMembers > 0 ? (membersWithSavings / totalMembers) * 100 : 0;

  const depositTransactions = transactions.filter(
    (transaction) => transaction.type === "DEPOSIT",
  );
  const withdrawalTransactions = transactions.filter(
    (transaction) => transaction.type === "WITHDRAWAL",
  );
  const totalDeposits = depositTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount.toString()),
    0,
  );
  const totalWithdrawals = withdrawalTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount.toString()),
    0,
  );
  const netSavingsFlow = totalDeposits - totalWithdrawals;
  const averageTxn =
    transactions.length > 0
      ? (totalDeposits + totalWithdrawals) / transactions.length
      : 0;

  const transactionRows = transactions.map((transaction) => ({
    id: transaction.id,
    memberLabel: memberMap.get(transaction.memberId) ?? transaction.memberId,
    type: transaction.type,
    amount: transaction.amount.toString(),
    note: transaction.note,
    createdAt: transaction.createdAt.toISOString(),
  }));

  return (
    <>
      <SiteHeader title="Savings" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                        Transactions
                      </p>
                      <h1 className="mt-2 text-2xl font-bold">Savings</h1>
                      <p className="mt-2 text-muted-foreground">
                        Record deposits and withdrawals with automatic balance checks.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {new Date().toLocaleString()} | Page {page}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/api/savings/export?format=csv&page=${page}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export CSV
                      </Link>
                      <Link
                        href={`/api/savings/export?format=pdf&page=${page}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export PDF
                      </Link>
                    </div>
                  </div>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Savings Snapshot</h2>
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
                        <tr className="border-t"><td className="px-3 py-2 text-xs">Total Members</td><td className="px-3 py-2 text-xs font-semibold">{totalMembers}</td><td className="px-3 py-2 text-xs text-muted-foreground">Active: {activeMembers}</td></tr>
                        <tr className="border-t"><td className="px-3 py-2 text-xs">Savings Pool</td><td className="px-3 py-2 text-xs font-semibold">{formatMoney(totalSavingsPool.toString())}</td><td className="px-3 py-2 text-xs text-muted-foreground">Members with balance: {membersWithSavings}</td></tr>
                        <tr className="border-t"><td className="px-3 py-2 text-xs">Savings Participation</td><td className="px-3 py-2 text-xs font-semibold">{savingsParticipation.toFixed(1)}%</td><td className="px-3 py-2 text-xs text-muted-foreground">Across all registered members</td></tr>
                        <tr className="border-t"><td className="px-3 py-2 text-xs">Deposits</td><td className="px-3 py-2 text-xs font-semibold text-emerald-700">{formatMoney(totalDeposits)}</td><td className="px-3 py-2 text-xs text-muted-foreground">Transactions: {depositTransactions.length}</td></tr>
                        <tr className="border-t"><td className="px-3 py-2 text-xs">Withdrawals</td><td className="px-3 py-2 text-xs font-semibold text-red-700">{formatMoney(totalWithdrawals)}</td><td className="px-3 py-2 text-xs text-muted-foreground">Transactions: {withdrawalTransactions.length}</td></tr>
                        <tr className="border-t"><td className="px-3 py-2 text-xs">Net Savings Flow</td><td className={`px-3 py-2 text-xs font-semibold ${netSavingsFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatMoney(netSavingsFlow)}</td><td className="px-3 py-2 text-xs text-muted-foreground">Avg transaction: {formatMoney(averageTxn)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <SavingsTransactionForm members={memberOptions} />

                <SavingsTransactionsPanel transactions={transactionRows} />

                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={page > 1 ? `/dashboard/savings?page=${page - 1}` : "#"}
                      className={`text-sm ${page > 1 ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Previous
                    </Link>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Link
                      href={hasNextPage ? `/dashboard/savings?page=${page + 1}` : "#"}
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
