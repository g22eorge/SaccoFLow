import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { AiInsightsService } from "@/src/server/services/ai-insights.service";

export const GET = withApiHandler(async () => {
  await requireRoles([
    "SACCO_ADMIN",
    "SUPER_ADMIN",
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "AUDITOR",
    "LOAN_OFFICER",
  ]);
  const { saccoId } = await requireSaccoContext();
  const data = await AiInsightsService.getOverview(saccoId);
  return ok(data);
});
