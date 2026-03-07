"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PlanCode = "STARTER" | "TIER_2" | "TIER_3";
type BillingCycle = "MONTHLY" | "ANNUAL";

type OrganizationRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: PlanCode;
  billingCycle: BillingCycle;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  monthlyAmount: string;
  currency: string;
  memberCount: number;
  userCount: number;
  usage: {
    activeMembers: number;
    memberLimit: number;
    remainingSlots: number;
    overLimit: boolean;
    usagePercent: number;
  };
};

type PlanOption = {
  code: PlanCode;
  label: string;
  memberLimit: number;
  monthlyAmount: string;
  annualAmount: string;
};

export function PlatformOrganizationsManager() {
  const router = useRouter();
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const planMap = useMemo(
    () => new Map(planOptions.map((option) => [option.code, option])),
    [planOptions],
  );

  const load = async () => {
    setError(null);
    const response = await fetch("/api/platform/organizations", {
      method: "GET",
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message ?? "Could not load organizations");
    }
    setRows(payload.data.organizations);
    setPlanOptions(payload.data.planOptions);
  };

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load organizations");
    });
  }, []);

  const updateOrg = async (
    orgId: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    setBusyId(orgId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/platform/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not update organization");
      }
      setMessage(successMessage);
      await load();
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update organization");
    } finally {
      setBusyId(null);
    }
  };

  const startSupportSession = async (code: string) => {
    setBusyId(code);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/platform/assume-tenant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saccoCode: code,
          reason: "Platform organization support session",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not start support session");
      }
      setMessage(`Support session started for ${code}`);
      router.push("/dashboard");
      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start support session");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Organizations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage organization subscription status, tiers, and support access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load().catch(() => undefined)}
          className="rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Usage</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Cycle</th>
              <th className="px-3 py-2">Period End</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((org) => {
              const selected = planMap.get(org.plan);
              const amount =
                org.billingCycle === "ANNUAL"
                  ? selected?.annualAmount ?? org.monthlyAmount
                  : selected?.monthlyAmount ?? org.monthlyAmount;

              return (
                <tr key={org.id} className="border-t align-top">
                  <td className="px-3 py-2 text-xs">
                    <p className="font-semibold">{org.code}</p>
                    <p className="text-muted-foreground">{org.name}</p>
                    <p className="text-muted-foreground">Members: {org.memberCount} | Users: {org.userCount}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border px-2 py-0.5">{org.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {org.usage.activeMembers}/{org.usage.memberLimit} ({org.usage.usagePercent}%)
                    {org.usage.overLimit ? (
                      <p className="mt-1 text-red-700">Over limit</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <select
                      value={org.plan}
                      onChange={(event) => {
                        const nextPlan = event.target.value as PlanCode;
                        setRows((previous) =>
                          previous.map((row) =>
                            row.id === org.id ? { ...row, plan: nextPlan } : row,
                          ),
                        );
                      }}
                      className="rounded border border-border bg-background px-2 py-1"
                      disabled={busyId === org.id}
                    >
                      {planOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold">
                    {org.currency} {amount}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <select
                      value={org.billingCycle}
                      onChange={(event) => {
                        const nextCycle = event.target.value as BillingCycle;
                        setRows((previous) =>
                          previous.map((row) =>
                            row.id === org.id
                              ? { ...row, billingCycle: nextCycle }
                              : row,
                          ),
                        );
                      }}
                      className="rounded border border-border bg-background px-2 py-1"
                      disabled={busyId === org.id}
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUAL">Annual</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {org.currentPeriodEndsAt
                      ? new Date(org.currentPeriodEndsAt).toLocaleDateString()
                      : `Trial: ${new Date(org.trialEndsAt).toLocaleDateString()}`}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === org.id}
                        onClick={() =>
                          void updateOrg(
                            org.id,
                            {
                              action: "UPDATE_PLAN",
                              plan: org.plan,
                              billingCycle: org.billingCycle,
                            },
                            `Updated plan for ${org.code}`,
                          )
                        }
                        className="rounded border border-border px-2 py-1"
                      >
                        Save tier
                      </button>
                      <button
                        type="button"
                        disabled={busyId === org.id}
                        onClick={() =>
                          void updateOrg(
                            org.id,
                            { action: org.status === "SUSPENDED" ? "REACTIVATE" : "SUSPEND" },
                            `${org.status === "SUSPENDED" ? "Reactivated" : "Suspended"} ${org.code}`,
                          )
                        }
                        className="rounded border border-border px-2 py-1"
                      >
                        {org.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === org.code}
                        onClick={() => void startSupportSession(org.code)}
                        className="rounded border border-border px-2 py-1"
                      >
                        Support login
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-xs text-muted-foreground" colSpan={8}>
                  No organizations found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
