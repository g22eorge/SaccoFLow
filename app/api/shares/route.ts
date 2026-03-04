import { NextRequest } from "next/server";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { SharesService } from "@/src/server/services/shares.service";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId } = await requireSaccoContext();
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const memberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59`) : undefined;

  const [transactions, totalShareCapital] = await Promise.all([
    SharesService.list({
      saccoId,
      memberId,
      page,
      from: fromDate,
      to: toDate,
    }),
    SharesService.getTotalShareCapital(saccoId),
  ]);

  return ok({
    totalShareCapital: totalShareCapital.toString(),
    transactions,
  });
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = { ...(await request.json()), saccoId };
  const transaction = await SharesService.record(payload, actorId);
  return created(transaction);
});
