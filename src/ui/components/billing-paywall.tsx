import Link from "next/link";
import { BillingCtaCard } from "@/src/ui/components/billing-cta-card";

export function BillingPaywall({
  role,
  trialDaysLeft,
  status,
  plan,
  billingCycle,
  currency,
  usage,
  planOptions,
}: {
  role: string;
  trialDaysLeft: number;
  status: string;
  plan: "STARTER" | "TIER_2" | "TIER_3";
  billingCycle: "MONTHLY" | "ANNUAL";
  currency: string;
  usage: {
    activeMembers: number;
    memberLimit: number;
    remainingSlots: number;
    usagePercent: number;
  };
  planOptions: Array<{
    code: "STARTER" | "TIER_2" | "TIER_3";
    label: string;
    memberLimit: number;
    monthlyAmount: string;
    annualAmount: string;
  }>;
}) {
  const canManage = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"].includes(role);

  return (
    <div className="mx-auto mt-8 w-full max-w-3xl px-4 lg:px-6">
      <section className="rounded-lg border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Plan Required</p>
        <h1 className="mt-2 text-2xl font-bold">Subscription Needed To Continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your 30-day trial has ended. Make a payment to unlock your full workspace again.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <BillingCtaCard
            canManage={canManage}
            trialDaysLeft={trialDaysLeft}
            status={status}
            currentPlan={plan}
            currentCycle={billingCycle}
            currency={currency}
            usage={usage}
            planOptions={planOptions}
          />
          <div className="rounded-lg border bg-background p-5">
            <h3 className="text-base font-semibold">What You Keep</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Secure records and audit history</li>
              <li>Members, savings, and borrowing workflows</li>
              <li>Reports and downloadable exports</li>
            </ul>
            <Link href="/dashboard/billing" className="mt-4 inline-block text-sm text-[#cc5500]">
              Open billing details
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
