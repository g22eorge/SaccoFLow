import { NextRequest } from "next/server";
import { LoansService } from "@/src/server/services/loans.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, withApiHandler } from "@/src/server/api/http";

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
    const { id: actorId, saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    const payload = { ...(await request.json()), saccoId };
    const repayment = await LoansService.repay(id, payload, actorId);
    return created(repayment);
  },
);
