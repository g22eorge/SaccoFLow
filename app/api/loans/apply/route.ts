import { NextRequest } from "next/server";
import { LoansService } from "@/src/server/services/loans.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, withApiHandler } from "@/src/server/api/http";

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "LOAN_OFFICER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = { ...(await request.json()), saccoId };
  const loan = await LoansService.apply(payload, actorId);
  return created(loan);
});
