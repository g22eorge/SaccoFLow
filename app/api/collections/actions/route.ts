import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";

const schema = z.object({
  loanId: z.string().min(1),
  actionType: z.enum([
    "CALL",
    "SMS",
    "VISIT",
    "PROMISE_TO_PAY",
    "RESTRUCTURE_REVIEW",
    "ESCALATION",
  ]),
  outcome: z.string().min(2).max(160),
  note: z.string().max(400).optional(),
  promiseAmount: z.coerce.number().positive().optional(),
  promiseDate: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "LOAN_OFFICER"]);
  const { saccoId, id: actorId } = await requireSaccoContext();
  const parsed = schema.parse(await request.json());

  const loan = await prisma.loan.findFirst({
    where: {
      id: parsed.loanId,
      saccoId,
      status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED", "APPROVED"] },
    },
    select: {
      id: true,
      memberId: true,
      status: true,
      principalAmount: true,
      outstandingPrincipal: true,
      outstandingInterest: true,
      outstandingPenalty: true,
      dueAt: true,
    },
  });

  if (!loan) {
    throw new Error("Loan case not found for collections action");
  }

  const payload = {
    loanId: loan.id,
    memberId: loan.memberId,
    actionType: parsed.actionType,
    outcome: parsed.outcome,
    note: parsed.note ?? null,
    promiseAmount: parsed.promiseAmount ?? null,
    promiseDate: parsed.promiseDate ?? null,
    nextFollowUpAt: parsed.nextFollowUpAt ?? null,
    recordedAt: new Date().toISOString(),
    loanSnapshot: {
      status: loan.status,
      principalAmount: loan.principalAmount.toString(),
      outstandingPrincipal: loan.outstandingPrincipal.toString(),
      outstandingInterest: loan.outstandingInterest.toString(),
      outstandingPenalty: loan.outstandingPenalty.toString(),
      dueAt: loan.dueAt?.toISOString() ?? null,
    },
  };

  await AuditService.record({
    saccoId,
    actorId,
    action: "COLLECTION_ACTION",
    entity: "CollectionAction",
    entityId: `${loan.id}:${Date.now()}`,
    after: payload,
  });

  return ok(payload);
});
