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
  const entity = request.nextUrl.searchParams.get("entity") ?? undefined;
  const actorId = request.nextUrl.searchParams.get("actorId") ?? undefined;
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");

  const auditLogs = await ReportsService.auditTrail({
    saccoId,
    entity,
    actorId,
    page,
  });

  return ok(auditLogs);
});
