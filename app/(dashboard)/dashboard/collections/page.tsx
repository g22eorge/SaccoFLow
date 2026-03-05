import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { SiteHeader } from "@/components/site-header";
import { CollectionsWorkbench } from "@/src/ui/components/collections-workbench";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function CollectionsPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "LOAN_OFFICER"].includes(role)) {
    redirect("/dashboard");
  }

  const [loans, members, actionLogs] = await Promise.all([
    prisma.loan.findMany({
      where: {
        saccoId,
        status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] },
      },
      select: {
        id: true,
        memberId: true,
        status: true,
        dueAt: true,
        principalAmount: true,
        outstandingPrincipal: true,
        outstandingInterest: true,
        outstandingPenalty: true,
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 200,
    }),
    prisma.member.findMany({
      where: { saccoId },
      select: { id: true, fullName: true },
    }),
    prisma.auditLog.findMany({
      where: {
        saccoId,
        entity: "CollectionAction",
      },
      select: {
        action: true,
        afterJson: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
  ]);

  const memberMap = new Map(members.map((member) => [member.id, member.fullName]));

  const latestActionByLoanId = new Map<
    string,
    {
      actionType: string;
      outcome: string | null;
      createdAtIso: string;
      nextFollowUpAt: string | null;
    }
  >();

  for (const row of actionLogs) {
    if (!row.afterJson) {
      continue;
    }
    try {
      const payload = JSON.parse(row.afterJson) as {
        loanId?: string;
        actionType?: string;
        outcome?: string;
        nextFollowUpAt?: string | null;
      };
      if (!payload.loanId || latestActionByLoanId.has(payload.loanId)) {
        continue;
      }
      latestActionByLoanId.set(payload.loanId, {
        actionType: payload.actionType ?? row.action,
        outcome: payload.outcome ?? null,
        createdAtIso: row.createdAt.toISOString(),
        nextFollowUpAt: payload.nextFollowUpAt ?? null,
      });
    } catch {
      continue;
    }
  }

  const now = new Date();
  const cases = loans
    .map((loan) => {
      const dueAtTime = loan.dueAt ? new Date(loan.dueAt).getTime() : null;
      const daysToDue =
        dueAtTime === null ? null : Math.ceil((dueAtTime - now.getTime()) / DAY_MS);
      const exposure =
        Number(loan.outstandingPrincipal.toString()) +
        Number(loan.outstandingInterest.toString()) +
        Number(loan.outstandingPenalty.toString());
      const principal = Math.max(1, Number(loan.principalAmount.toString()));
      const ratio = exposure / principal;

      let severity: "High" | "Medium" | "Watch" | null = null;
      let reason = "";
      let recommendation = "";
      let priority = 0;

      if (daysToDue !== null && daysToDue < 0) {
        severity = "High";
        reason = `${Math.abs(daysToDue)} days overdue`;
        recommendation = "Call now, agree recovery timeline, and log commitment.";
        priority = 100 + Math.abs(daysToDue);
      } else if (daysToDue !== null && daysToDue <= 14 && ratio >= 0.8) {
        severity = "Medium";
        reason = "High outstanding near due date";
        recommendation = "Send reminder and set follow-up within 72 hours.";
        priority = 70 + (14 - daysToDue);
      } else if (daysToDue !== null && daysToDue <= 30) {
        severity = "Watch";
        reason = `Due in ${daysToDue} days`;
        recommendation = "Schedule proactive contact and monitor weekly.";
        priority = 40 + (30 - daysToDue);
      }

      if (!severity) {
        return null;
      }

      const action = latestActionByLoanId.get(loan.id);

      return {
        loanId: loan.id,
        memberName: memberMap.get(loan.memberId) ?? loan.memberId,
        status: loan.status,
        dueAt: loan.dueAt?.toISOString() ?? null,
        daysToDue,
        exposure: exposure.toString(),
        severity,
        reason,
        recommendation,
        lastActionAt: action?.createdAtIso ?? null,
        lastActionType: action?.actionType ?? null,
        lastActionOutcome: action?.outcome ?? null,
        nextFollowUpAt: action?.nextFollowUpAt ?? null,
        priority,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.priority - a.priority);

  return (
    <>
      <SiteHeader title="Collections" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <CollectionsWorkbench cases={cases} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
