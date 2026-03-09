import { NextRequest } from "next/server";
import { LoansService } from "@/src/server/services/loans.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, withApiHandler } from "@/src/server/api/http";
import { IdempotencyService } from "@/src/server/services/idempotency.service";

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireWriteRoles(["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER"]);
    const { id: actorId, saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    const payload = { ...(await request.json()), saccoId };
    const idempotencyKey = IdempotencyService.getKeyFromRequest(request);
    const { data: repayment } = await IdempotencyService.run({
      saccoId,
      scope: `LOAN_REPAY_${id}`,
      key: idempotencyKey,
      execute: () => LoansService.repay(id, payload, actorId),
    });
    return created(repayment);
  },
);
