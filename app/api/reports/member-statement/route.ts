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
  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    throw new Error("memberId is required");
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const statement = await ReportsService.memberStatement({
    saccoId,
    memberId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return ok(statement);
});
