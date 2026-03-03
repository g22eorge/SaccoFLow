import { NextRequest } from "next/server";
import { ReportsService } from "@/src/server/services/reports.service";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles([
    "SACCO_ADMIN",
    "SUPER_ADMIN",
    "TREASURER",
    "AUDITOR",
    "LOAN_OFFICER",
  ]);
  const { saccoId } = await requireSaccoContext();
  const period = request.nextUrl.searchParams.get("period") ?? "daily";
  const report = await ReportsService.summary(period, saccoId);
  return ok(report);
});
