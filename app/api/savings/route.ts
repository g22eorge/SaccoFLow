import { NextRequest } from "next/server";
import { SavingsService } from "@/src/server/services/savings.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId } = await requireSaccoContext();
  const memberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const transactions = await SavingsService.list({ saccoId, memberId, page });
  return ok(transactions);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = { ...(await request.json()), saccoId };
  const transaction = await SavingsService.record(payload, actorId);
  return created(transaction);
});
