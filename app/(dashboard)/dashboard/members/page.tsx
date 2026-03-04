import { requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { CreateMemberForm } from "@/src/ui/forms/create-member-form";
import { MembersTable } from "@/src/ui/tables/members-table";
import { SiteHeader } from "@/components/site-header";

export default async function MembersPage() {
  const { saccoId } = await requireSaccoContext();
  const members = await MembersService.list({ saccoId, page: 1 });
  const balances = await Promise.all(
    members.map(async (member) => ({
      memberId: member.id,
      balance: await SavingsService.getMemberBalance(saccoId, member.id),
    })),
  );

  const balanceMap = new Map(
    balances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const tableMembers = members.map((member) => ({
    id: member.id,
    memberNumber: member.memberNumber,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    status: member.status,
    savingsBalance: balanceMap.get(member.id) ?? "0",
  }));

  return (
    <>
      <SiteHeader />
      <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Directory
        </p>
        <h1 className="mt-2 text-2xl font-bold">Members</h1>
        <p className="mt-2 text-slate-600">
          Manage SACCO members and maintain their profiles.
        </p>
      </div>
      <CreateMemberForm />
      <MembersTable members={tableMembers} />
    </section>
    </>
  );
}
