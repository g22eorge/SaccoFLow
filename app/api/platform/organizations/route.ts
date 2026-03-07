import { ok, withApiHandler } from "@/src/server/api/http";
import { requirePlatformSuperAdmin } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { BillingService } from "@/src/server/services/billing.service";

export const GET = withApiHandler(async () => {
  await requirePlatformSuperAdmin();

  const organizations = await prisma.sacco.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          plan: true,
          billingCycle: true,
          trialEndsAt: true,
          currentPeriodEndsAt: true,
          monthlyAmount: true,
          currency: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          members: true,
          appUsers: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const rows = await Promise.all(
    organizations.map(async (org) => {
      const fallback = org.subscription
        ? org.subscription
        : await BillingService.getOrCreateSubscription(org.id);
      const usage = await BillingService.getUsage(org.id, fallback.plan);
      return {
        id: org.id,
        code: org.code,
        name: org.name,
        createdAt: org.createdAt.toISOString(),
        status: fallback.status,
        plan: fallback.plan,
        billingCycle: fallback.billingCycle,
        trialEndsAt: fallback.trialEndsAt.toISOString(),
        currentPeriodEndsAt: fallback.currentPeriodEndsAt?.toISOString() ?? null,
        monthlyAmount: fallback.monthlyAmount.toString(),
        currency: fallback.currency,
        memberCount: org._count.members,
        userCount: org._count.appUsers,
        usage,
        updatedAt: fallback.updatedAt.toISOString(),
      };
    }),
  );

  return ok({
    organizations: rows,
    planOptions: BillingService.planOptions().map((plan) => ({
      ...plan,
      monthlyAmount: plan.monthlyAmount.toString(),
      annualAmount: plan.annualAmount.toString(),
    })),
  });
});
