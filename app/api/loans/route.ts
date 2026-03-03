import { NextRequest } from "next/server";
import { LoansService } from "@/src/server/services/loans.service";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId } = await requireSaccoContext();
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const loans = await LoansService.list({ saccoId, status });
  return ok(loans);
});
