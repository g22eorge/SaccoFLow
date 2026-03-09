import { ok, withApiHandler } from "@/src/server/api/http";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const roleInGroup = (userRole: string, group: "CREDIT" | "FINANCE") => {
  if (group === "CREDIT") {
    return ["LOAN_OFFICER", "SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(userRole);
  }
  return ["TREASURER", "SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(userRole);
};

export const GET = withApiHandler(async () => {
  const context = await requireSaccoContext();
  const { saccoId, id: actorId, role } = context;

  const memberRequestLogs = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "MemberRequest",
    },
    select: {
      entityId: true,
      afterJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const latestMemberRequestByEntityId = new Map<string, string | null>();
  for (const log of memberRequestLogs) {
    if (latestMemberRequestByEntityId.has(log.entityId)) {
      continue;
    }
    latestMemberRequestByEntityId.set(log.entityId, log.afterJson);
  }

  const pendingMemberRequests = Array.from(latestMemberRequestByEntityId.values()).reduce(
    (count, afterJson) => {
      if (!afterJson) {
        return count;
      }
      try {
        const parsed = JSON.parse(afterJson) as { status?: unknown };
        return parsed.status === "PENDING" ? count + 1 : count;
      } catch {
        return count;
      }
    },
    0,
  );

  const defaultedCollectionCases = await prisma.loan.count({
    where: {
      saccoId,
      status: "DEFAULTED",
    },
  });

  const canApprove = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"].includes(role);
  if (!canApprove) {
    return ok({ pendingLoanRequests: 0, pendingMemberRequests, defaultedCollectionCases });
  }

  const pendingLoans = await prisma.loan.findMany({
    where: { saccoId, status: "PENDING" },
    select: { id: true },
  });

  if (pendingLoans.length === 0) {
    return ok({ pendingLoanRequests: 0, pendingMemberRequests, defaultedCollectionCases });
  }

  const approvalMatrixStates = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "LoanApprovalMatrixState",
      entityId: { in: pendingLoans.map((loan) => loan.id) },
    },
    select: { entityId: true, afterJson: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const matrixByLoanId = new Map<
    string,
    {
      requiredApproverCount: number;
      requiredRoleGroups: Array<"CREDIT" | "FINANCE">;
      approvals: Array<{ actorId?: string; actorRole?: string }>;
      completed: boolean;
    }
  >();

  for (const entry of approvalMatrixStates) {
    if (matrixByLoanId.has(entry.entityId) || !entry.afterJson) {
      continue;
    }
    try {
      const parsed = JSON.parse(entry.afterJson) as {
        requiredApproverCount?: number;
        requiredRoleGroups?: unknown[];
        approvals?: unknown[];
        completed?: boolean;
      };
      matrixByLoanId.set(entry.entityId, {
        requiredApproverCount: Number(parsed.requiredApproverCount ?? 1),
        requiredRoleGroups: Array.isArray(parsed.requiredRoleGroups)
          ? parsed.requiredRoleGroups.filter((g): g is "CREDIT" | "FINANCE" => g === "CREDIT" || g === "FINANCE")
          : ["CREDIT"],
        approvals: Array.isArray(parsed.approvals)
          ? parsed.approvals.filter((step): step is { actorId?: string; actorRole?: string } => typeof step === "object" && step !== null)
          : [],
        completed: Boolean(parsed.completed),
      });
    } catch {
      continue;
    }
  }

  const pendingLoanRequests = pendingLoans.filter((loan) => {
    const matrix = matrixByLoanId.get(loan.id);
    if (!matrix) {
      return roleInGroup(role, "CREDIT") || roleInGroup(role, "FINANCE");
    }
    if (matrix.completed) {
      return false;
    }
    if (matrix.approvals.some((step) => step.actorId === actorId)) {
      return false;
    }
    const roleEligible = matrix.requiredRoleGroups.some((group) => roleInGroup(role, group));
    if (!roleEligible) {
      return false;
    }
    const currentCount = matrix.approvals.length;
    const groupCoverage = matrix.requiredRoleGroups.every((group) =>
      matrix.approvals.some((step) => roleInGroup(step.actorRole ?? "", group)),
    );
    return currentCount < matrix.requiredApproverCount || !groupCoverage;
  }).length;

  return ok({ pendingLoanRequests, pendingMemberRequests, defaultedCollectionCases });
});
