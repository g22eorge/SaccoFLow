import { NextRequest } from "next/server";
import { SavingsService } from "@/src/server/services/savings.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, withApiHandler } from "@/src/server/api/http";

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = { ...(await request.json()), type: "WITHDRAWAL", saccoId };
  const transaction = await SavingsService.withdraw(payload, actorId);
  return created(transaction);
});
