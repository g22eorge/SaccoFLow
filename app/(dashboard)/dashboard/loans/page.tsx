import { requireSaccoContext } from "@/src/server/auth/rbac";
import { LoansService } from "@/src/server/services/loans.service";
import { MembersService } from "@/src/server/services/members.service";
import { LoanManagement } from "@/src/ui/forms/loan-management";
import { SiteHeader } from "@/components/site-header";

export default async function LoansPage() {
  const { saccoId } = await requireSaccoContext();
  const [members, loans] = await Promise.all([
    MembersService.list({ saccoId, page: 1 }),
    LoansService.list({ saccoId }),
  ]);

  const memberMap = new Map(
    members.map((member) => [
      member.id,
      `${member.memberNumber} - ${member.fullName}`,
    ]),
  );

  const loanRows = loans.map((loan) => ({
    id: loan.id,
    memberId: loan.memberId,
    memberName: memberMap.get(loan.memberId) ?? loan.memberId,
    status: loan.status,
    termMonths: loan.termMonths,
    dueAt: loan.dueAt?.toISOString() ?? null,
    principalAmount: loan.principalAmount.toString(),
    outstandingPrincipal: loan.outstandingPrincipal.toString(),
    outstandingInterest: loan.outstandingInterest.toString(),
    outstandingPenalty: loan.outstandingPenalty.toString(),
  }));

  const memberOptions = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNumber: member.memberNumber,
  }));

  return (
    <>
      <SiteHeader title="Loans" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Credit Desk
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Loans</h1>
                  <p className="mt-2 text-muted-foreground">
                    Process loan applications from submission to repayment.
                  </p>
                </div>
                <LoanManagement members={memberOptions} loans={loanRows} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
