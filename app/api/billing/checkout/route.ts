import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { BillingService } from "@/src/server/services/billing.service";
import { z } from "zod";

const checkoutSchema = z
  .object({
    plan: z.enum(["STARTER", "TIER_2", "TIER_3"]).optional(),
    billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  })
  .optional();

export const POST = withApiHandler(async (request: Request) => {
  const actor = await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
  const { saccoId } = await requireSaccoContext();
  const parsed = checkoutSchema.parse(await request.json().catch(() => ({})));
  const checkout = await BillingService.startCheckout(saccoId, actor.id, parsed);
  return ok(checkout);
});
