import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requirePlatformSuperAdmin } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { BillingService } from "@/src/server/services/billing.service";

const updateSchema = z.object({
  action: z.enum(["SUSPEND", "REACTIVATE", "UPDATE_PLAN"]),
  plan: z.enum(["STARTER", "TIER_2", "TIER_3"]).optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});

export const PATCH = withApiHandler(
  async (
    request: Request,
    context: { params: Promise<{ saccoId: string }> },
  ) => {
    await requirePlatformSuperAdmin();
    const { saccoId } = await context.params;
    const payload = updateSchema.parse(await request.json());

    await BillingService.getOrCreateSubscription(saccoId);

    if (payload.action === "SUSPEND") {
      await prisma.saccoSubscription.update({
        where: { saccoId },
        data: { status: "SUSPENDED" },
      });
    } else if (payload.action === "REACTIVATE") {
      await prisma.saccoSubscription.update({
        where: { saccoId },
        data: { status: "ACTIVE" },
      });
    } else {
      await BillingService.updatePlan(saccoId, {
        plan: payload.plan,
        billingCycle: payload.billingCycle,
      });
    }

    const access = await BillingService.getAccessState(saccoId);
    return ok({
      saccoId,
      status: access.subscription.status,
      plan: access.subscription.plan,
      billingCycle: access.subscription.billingCycle,
      trialEndsAt: access.subscription.trialEndsAt.toISOString(),
      currentPeriodEndsAt: access.subscription.currentPeriodEndsAt?.toISOString() ?? null,
      usage: access.usage,
      selectedAmount: access.selectedAmount.toString(),
      currency: access.subscription.currency,
    });
  },
);
