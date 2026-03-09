import { NextRequest } from "next/server";
import { SavingsService } from "@/src/server/services/savings.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { SettingsService } from "@/src/server/services/settings.service";
import { IdempotencyService } from "@/src/server/services/idempotency.service";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId } = await requireSaccoContext();
  await SettingsService.assertCapitalEnabled(saccoId, "SAVINGS");
  const memberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59`) : undefined;
  const transactions = await SavingsService.list({
    saccoId,
    memberId,
    page,
    from: fromDate,
    to: toDate,
  });
  return ok(transactions);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  await SettingsService.assertCapitalEnabled(saccoId, "SAVINGS");
  const payload = { ...(await request.json()), saccoId };
  const idempotencyKey = IdempotencyService.getKeyFromRequest(request);
  const { data: transaction } = await IdempotencyService.run({
    saccoId,
    scope: "SAVINGS_RECORD",
    key: idempotencyKey,
    execute: () => SavingsService.record(payload, actorId),
  });
  return created(transaction);
});
