import { BillingCycle, Prisma, SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";

const TRIAL_DAYS = 30;
const DEFAULT_CURRENCY = "UGX";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const PLAN_CONFIG: Record<
  SubscriptionPlan,
  {
    label: string;
    memberLimit: number;
    monthlyAmount: Prisma.Decimal;
    annualAmount: Prisma.Decimal;
  }
> = {
  STARTER: {
    label: "Starter",
    memberLimit: 200,
    monthlyAmount: new Prisma.Decimal(120000),
    annualAmount: new Prisma.Decimal(1200000),
  },
  TIER_2: {
    label: "Tier 2",
    memberLimit: 1000,
    monthlyAmount: new Prisma.Decimal(420000),
    annualAmount: new Prisma.Decimal(4200000),
  },
  TIER_3: {
    label: "Tier 3",
    memberLimit: 100000,
    monthlyAmount: new Prisma.Decimal(1200000),
    annualAmount: new Prisma.Decimal(12000000),
  },
};

const normalizePlan = (plan: SubscriptionPlan | string | null | undefined): SubscriptionPlan => {
  if (plan === "TIER_2" || plan === "TIER_3" || plan === "STARTER") {
    return plan;
  }
  return "STARTER";
};

const normalizeCycle = (cycle: BillingCycle | string | null | undefined): BillingCycle => {
  if (cycle === "ANNUAL" || cycle === "MONTHLY") {
    return cycle;
  }
  return "MONTHLY";
};

const planAmount = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === "ANNUAL"
    ? PLAN_CONFIG[plan].annualAmount
    : PLAN_CONFIG[plan].monthlyAmount;

export const BillingService = {
  planOptions() {
    return Object.entries(PLAN_CONFIG).map(([key, config]) => ({
      code: key as SubscriptionPlan,
      label: config.label,
      memberLimit: config.memberLimit,
      monthlyAmount: config.monthlyAmount,
      annualAmount: config.annualAmount,
    }));
  },

  async getOrCreateSubscription(saccoId: string) {
    const existing = await prisma.saccoSubscription.findUnique({
      where: { saccoId },
      include: {
        billingEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const sacco = await prisma.sacco.findUnique({
      where: { id: saccoId },
      select: { createdAt: true },
    });
    const now = new Date();
    const trialStartsAt = sacco?.createdAt ?? now;
    const trialEndsAt = addDays(trialStartsAt, TRIAL_DAYS);

    return prisma.saccoSubscription.create({
      data: {
        saccoId,
        status: "TRIALING",
        plan: "STARTER",
        billingCycle: "MONTHLY",
        trialStartsAt,
        trialEndsAt,
        monthlyAmount: PLAN_CONFIG.STARTER.monthlyAmount,
        currency: DEFAULT_CURRENCY,
      },
      include: {
        billingEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
  },

  async getUsage(saccoId: string, plan: SubscriptionPlan) {
    const safePlan = normalizePlan(plan);
    const activeMembers = await prisma.member.count({
      where: {
        saccoId,
        status: "ACTIVE",
      },
    });
    const memberLimit = PLAN_CONFIG[safePlan].memberLimit;
    const remainingSlots = Math.max(0, memberLimit - activeMembers);
    return {
      activeMembers,
      memberLimit,
      remainingSlots,
      overLimit: activeMembers > memberLimit,
      usagePercent: memberLimit > 0 ? Math.min(100, Math.round((activeMembers / memberLimit) * 100)) : 0,
    };
  },

  async assertCanAddMember(saccoId: string) {
    const subscription = await this.getOrCreateSubscription(saccoId);
    const safePlan = normalizePlan(subscription.plan);
    const usage = await this.getUsage(saccoId, safePlan);
    if (usage.activeMembers >= usage.memberLimit) {
      throw new Error(
        `Member limit reached for ${PLAN_CONFIG[safePlan].label} (${usage.memberLimit}). Upgrade plan in Billing to add more members.`,
      );
    }
  },

  async getAccessState(saccoId: string) {
    const subscription = await this.getOrCreateSubscription(saccoId);
    const safePlan = normalizePlan(subscription.plan);
    const safeCycle = normalizeCycle(subscription.billingCycle);
    const now = new Date();
    const msLeft = subscription.trialEndsAt.getTime() - now.getTime();
    const trialDaysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

    const trialActive =
      subscription.status === "TRIALING" && subscription.trialEndsAt > now;
    const canAccess = subscription.status === "ACTIVE" || trialActive;
    const usage = await this.getUsage(saccoId, safePlan);
    const selectedAmount = planAmount(safePlan, safeCycle);

    return {
      canAccess,
      trialDaysLeft,
      usage,
      selectedAmount,
      planOptions: this.planOptions(),
      subscription,
    };
  },

  async updatePlan(
    saccoId: string,
    input: { plan?: SubscriptionPlan; billingCycle?: BillingCycle },
  ) {
    const subscription = await this.getOrCreateSubscription(saccoId);
    const nextPlan = normalizePlan(input.plan ?? subscription.plan);
    const nextCycle = normalizeCycle(input.billingCycle ?? subscription.billingCycle);

    const updated = await prisma.saccoSubscription.update({
      where: { id: subscription.id },
      data: {
        plan: nextPlan,
        billingCycle: nextCycle,
        monthlyAmount: planAmount(nextPlan, "MONTHLY"),
      },
      include: {
        billingEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    return updated;
  },

  async startCheckout(
    saccoId: string,
    actorId?: string,
    options?: { plan?: SubscriptionPlan; billingCycle?: BillingCycle },
  ) {
    if (options?.plan || options?.billingCycle) {
      await this.updatePlan(saccoId, {
        plan: options?.plan,
        billingCycle: options?.billingCycle,
      });
    }

    const subscription = await this.getOrCreateSubscription(saccoId);
    const safePlan = normalizePlan(subscription.plan);
    const safeCycle = normalizeCycle(subscription.billingCycle);
    const checkoutAmount = planAmount(safePlan, safeCycle);
    const merchantRef = `SACCOFLOW-${saccoId}-${Date.now()}`;
    const payload = {
      merchantReference: merchantRef,
      amount: Number(checkoutAmount),
      currency: subscription.currency,
      saccoId,
      actorId: actorId ?? null,
      plan: safePlan,
      billingCycle: safeCycle,
    };

    const event = await prisma.billingEvent.create({
      data: {
        saccoId,
        subscriptionId: subscription.id,
        provider: "PESAPAL",
        eventType: "CHECKOUT_INITIATED",
        status: "PENDING",
        amount: checkoutAmount,
        currency: subscription.currency,
        reference: merchantRef,
        payloadJson: JSON.stringify(payload),
      },
    });

    await prisma.saccoSubscription.update({
      where: { id: subscription.id },
      data: { pesapalMerchantRef: merchantRef },
    });

    const callbackUrl =
      process.env.PESAPAL_CALLBACK_URL ??
      "https://example.com/api/billing/pesapal/webhook";
    const checkoutBase =
      process.env.PESAPAL_CHECKOUT_URL ??
      "https://pay.pesapal.com/iframe/PesapalIframe3/Index";
    const checkoutUrl = `${checkoutBase}?OrderTrackingId=${encodeURIComponent(event.id)}&merchant_reference=${encodeURIComponent(merchantRef)}&callback_url=${encodeURIComponent(callbackUrl)}`;

    return {
      checkoutUrl,
      merchantReference: merchantRef,
      amount: checkoutAmount.toString(),
      billingCycle: safeCycle,
      plan: safePlan,
    };
  },

  async markPaidByReference(reference: string, payload?: unknown) {
    const pending = await prisma.billingEvent.findFirst({
      where: { reference, provider: "PESAPAL" },
      orderBy: { createdAt: "desc" },
      include: { subscription: true },
    });

    if (!pending) {
      throw new Error("Billing reference not found");
    }

    const now = new Date();
    const nextPeriod = addDays(
      now,
      pending.subscription.billingCycle === "ANNUAL" ? 365 : 30,
    );

    await prisma.$transaction([
      prisma.billingEvent.update({
        where: { id: pending.id },
        data: {
          status: "SUCCESS",
          eventType: "PAYMENT_CONFIRMED",
          payloadJson: payload ? JSON.stringify(payload) : pending.payloadJson,
        },
      }),
      prisma.saccoSubscription.update({
        where: { id: pending.subscriptionId },
        data: {
          status: "ACTIVE",
          graceEndsAt: null,
          currentPeriodEndsAt: nextPeriod,
          pesapalMerchantRef: reference,
        },
      }),
    ]);

    return { ok: true };
  },
};
