import { requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { SavingsTransactionForm } from "@/src/ui/forms/savings-transaction-form";
import { formatMoney } from "@/src/lib/money";
import { SiteHeader } from "@/components/site-header";

export default async function SavingsPage() {
  const { saccoId } = await requireSaccoContext();
  const members = await MembersService.list({ saccoId, page: 1 });
  const transactions = await SavingsService.list({ saccoId, page: 1 });
  const balances = await Promise.all(
    members.map(async (member) => ({
      memberId: member.id,
      balance: await SavingsService.getMemberBalance(saccoId, member.id),
    })),
  );

  const memberMap = new Map(
    members.map((member) => [
      member.id,
      `${member.memberNumber} - ${member.fullName}`,
    ]),
  );
  const balanceMap = new Map(
    balances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    balance: balanceMap.get(member.id) ?? "0",
  }));

  return (
    <>
      <SiteHeader />
      <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Transactions
        </p>
        <h1 className="mt-2 text-2xl font-bold">Savings</h1>
        <p className="mt-2 text-slate-600">
          Record deposits and withdrawals with automatic balance checks.
        </p>
      </div>

      <SavingsTransactionForm members={memberOptions} />

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {transactions.map((transaction) => (
            <article
              key={transaction.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {memberMap.get(transaction.memberId) ?? transaction.memberId}
                </p>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {transaction.type}
                </span>
              </div>
              <p className="mt-2 text-sm">
                Amount:{" "}
                <span className="font-semibold">
                  {formatMoney(transaction.amount.toString())}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Note: {transaction.note ?? "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">No transactions found.</p>
          ) : null}
        </div>
      </div>
    </section>
    </>
  );
}
