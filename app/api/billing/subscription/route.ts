import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { BillingService } from "@/src/server/services/billing.service";
import { z } from "zod";

const updateSchema = z.object({
  plan: z.enum(["STARTER", "TIER_2", "TIER_3"]).optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});

export const GET = withApiHandler(async () => {
  await requireRoles([
    "SACCO_ADMIN",
    "SUPER_ADMIN",
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "AUDITOR",
    "LOAN_OFFICER",
    "MEMBER",
  ]);
  const { saccoId } = await requireSaccoContext();
  const access = await BillingService.getAccessState(saccoId);

  return ok({
    status: access.subscription.status,
    plan: access.subscription.plan,
    billingCycle: access.subscription.billingCycle,
    trialEndsAt: access.subscription.trialEndsAt.toISOString(),
    currentPeriodEndsAt: access.subscription.currentPeriodEndsAt?.toISOString() ?? null,
    monthlyAmount: access.subscription.monthlyAmount.toString(),
    selectedAmount: access.selectedAmount.toString(),
    currency: access.subscription.currency,
    trialDaysLeft: access.trialDaysLeft,
    canAccess: access.canAccess,
    usage: access.usage,
    planOptions: access.planOptions.map((plan) => ({
      ...plan,
      monthlyAmount: plan.monthlyAmount.toString(),
      annualAmount: plan.annualAmount.toString(),
    })),
    recentEvents: access.subscription.billingEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      status: event.status,
      amount: event.amount.toString(),
      currency: event.currency,
      reference: event.reference,
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

export const PATCH = withApiHandler(async (request: Request) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
  const { saccoId } = await requireSaccoContext();
  const parsed = updateSchema.parse(await request.json());

  const updated = await BillingService.updatePlan(saccoId, parsed);
  const access = await BillingService.getAccessState(saccoId);
  return ok({
    plan: updated.plan,
    billingCycle: updated.billingCycle,
    selectedAmount: access.selectedAmount.toString(),
    usage: access.usage,
  });
});
