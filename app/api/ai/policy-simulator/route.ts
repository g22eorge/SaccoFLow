import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { AiInsightsService } from "@/src/server/services/ai-insights.service";

const schema = z.object({
  greenMinScore: z.coerce.number().min(0).max(100).optional(),
  creditCapacityMultiplier: z.coerce.number().positive().optional(),
  minRepaymentCount: z.coerce.number().int().nonnegative().optional(),
  utilizationWarningThreshold: z.coerce.number().nonnegative().optional(),
  utilizationHardStopThreshold: z.coerce.number().nonnegative().optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"]);
  const { saccoId } = await requireSaccoContext();
  const parsed = schema.parse(await request.json());
  const result = await AiInsightsService.simulatePolicy({
    saccoId,
    overrides: parsed,
  });
  return ok(result);
});
