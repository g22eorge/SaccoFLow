import { requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { CreateMemberForm } from "@/src/ui/forms/create-member-form";
import { ShareTransactionForm } from "@/src/ui/forms/share-transaction-form";
import { MembersTable } from "@/src/ui/tables/members-table";
import { formatMoney } from "@/src/lib/money";
import { SiteHeader } from "@/components/site-header";
import { Prisma } from "@prisma/client";

export default async function MembersPage() {
  const { saccoId } = await requireSaccoContext();
  const members = await MembersService.list({ saccoId, page: 1 });
  const [balances, shareBalances, shareCapitalTotal, shareTransactions] =
    await Promise.all([
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
      SharesService.getTotalShareCapital(saccoId),
      SharesService.list({ saccoId, page: 1 }),
    ]);

  const balanceMap = new Map(
    balances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const shareBalanceMap = new Map(
    shareBalances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const tableMembers = members.map((member) => ({
    id: member.id,
    memberNumber: member.memberNumber,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    status: member.status,
    savingsBalance: balanceMap.get(member.id) ?? "0",
    shareBalance: shareBalanceMap.get(member.id) ?? "0",
  }));

  const totalSavings = balances.reduce(
    (sum, entry) => sum.plus(entry.balance),
    new Prisma.Decimal(0),
  );

  const shareMemberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
    shareBalance: shareBalanceMap.get(member.id) ?? "0",
  }));

  return (
    <>
      <SiteHeader title="Members" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Directory
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Members</h1>
                  <p className="mt-2 text-muted-foreground">
                    Manage SACCO members and maintain their profiles.
                  </p>
                </div>
                <section className="rounded-lg border bg-card p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Savings</p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatMoney(totalSavings.toString())}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Share Capital</p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatMoney(shareCapitalTotal.toString())}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Recent share transactions: {shareTransactions.length}
                  </p>
                </section>
                <ShareTransactionForm members={shareMemberOptions} />
                <CreateMemberForm />
                <MembersTable members={tableMembers} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
