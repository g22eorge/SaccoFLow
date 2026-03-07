"use client";

import { useState } from "react";

export function BillingCtaCard({
  canManage,
  trialDaysLeft,
  status,
  currentPlan = "STARTER",
  currentCycle = "MONTHLY",
  currency = "UGX",
  usage = {
    activeMembers: 0,
    memberLimit: 200,
    remainingSlots: 200,
    usagePercent: 0,
  },
  planOptions = [
    {
      code: "STARTER",
      label: "Starter",
      memberLimit: 200,
      monthlyAmount: "120000",
      annualAmount: "1200000",
    },
    {
      code: "TIER_2",
      label: "Tier 2",
      memberLimit: 1000,
      monthlyAmount: "420000",
      annualAmount: "4200000",
    },
    {
      code: "TIER_3",
      label: "Tier 3",
      memberLimit: 100000,
      monthlyAmount: "1200000",
      annualAmount: "12000000",
    },
  ],
}: {
  canManage: boolean;
  trialDaysLeft: number;
  status: string;
  currentPlan?: "STARTER" | "TIER_2" | "TIER_3";
  currentCycle?: "MONTHLY" | "ANNUAL";
  currency?: string;
  usage?: {
    activeMembers: number;
    memberLimit: number;
    remainingSlots: number;
    usagePercent: number;
  };
  planOptions?: Array<{
    code: "STARTER" | "TIER_2" | "TIER_3";
    label: string;
    memberLimit: number;
    monthlyAmount: string;
    annualAmount: string;
  }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState(currentPlan);
  const [billingCycle, setBillingCycle] = useState(currentCycle);

  const selectedPlan =
    planOptions.find((option) => option.code === plan) ?? planOptions[0];
  const selectedAmount =
    billingCycle === "ANNUAL"
      ? selectedPlan?.annualAmount ?? "0"
      : selectedPlan?.monthlyAmount ?? "0";

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data?.checkoutUrl) {
        throw new Error(payload.error?.message ?? "Could not start payment checkout");
      }
      window.location.assign(payload.data.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start payment");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Subscription</p>
      <h3 className="mt-2 text-lg font-semibold">Keep Your Organization Active</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {status === "TRIALING"
          ? `You have ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`
          : "Your trial has ended. Please pay to continue using all features."}
      </p>
      <div className="mt-3 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
        Members: {usage.activeMembers}/{usage.memberLimit} used ({usage.usagePercent}%) | Remaining: {usage.remainingSlots}
      </div>
      {canManage ? (
        <div className="mt-3 grid gap-2">
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value as "STARTER" | "TIER_2" | "TIER_3")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {planOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label} (up to {option.memberLimit} members)
              </option>
            ))}
          </select>
          <select
            value={billingCycle}
            onChange={(event) =>
              setBillingCycle(event.target.value as "MONTHLY" | "ANNUAL")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="MONTHLY">Monthly billing</option>
            <option value="ANNUAL">Annual billing (save more)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Selected amount: {currency} {selectedAmount}
          </p>
        </div>
      ) : null}
      {canManage ? (
        <button
          type="button"
          disabled={loading}
          onClick={startCheckout}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Opening PesaPal..." : "Pay with PesaPal"}
        </button>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Ask your administrator, chairperson, or treasurer to complete payment.
        </p>
      )}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
