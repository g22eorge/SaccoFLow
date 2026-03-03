import { NextRequest } from "next/server";
import { ok, fail, withApiHandler } from "@/src/server/api/http";
import { LoanLifecycleService } from "@/src/server/services/loan-lifecycle.service";

export const POST = withApiHandler(async (request: NextRequest) => {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("x-cron-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return fail("Unauthorized", 401, "AUTH_ERROR");
  }

  const payload = await request.json().catch(() => ({}));
  const saccoId =
    typeof payload?.saccoId === "string" ? payload.saccoId : undefined;
  const asOf =
    typeof payload?.asOf === "string" ? new Date(payload.asOf) : new Date();

  const result = saccoId
    ? await LoanLifecycleService.reconcileSacco(saccoId, asOf)
    : await LoanLifecycleService.reconcileAll(asOf);

  return ok(result);
});
