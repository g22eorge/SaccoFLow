"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TenantOption = {
  code: string;
  name: string;
};

type ActiveAssumption = {
  saccoCode: string;
  reason: string;
  startedAtIso: string;
} | null;

export function PlatformAssumeTenant({
  tenants,
  activeAssumption,
}: {
  tenants: TenantOption[];
  activeAssumption: ActiveAssumption;
}) {
  const router = useRouter();
  const [saccoCode, setSaccoCode] = useState(activeAssumption?.saccoCode ?? tenants[0]?.code ?? "");
  const [reason, setReason] = useState(activeAssumption?.reason ?? "Support diagnostics and guidance");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedTenants = useMemo(
    () => [...tenants].sort((a, b) => a.code.localeCompare(b.code)),
    [tenants],
  );

  const startSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/platform/assume-tenant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saccoCode, reason }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to start tenant session");
      }

      setMessage(`Assumed tenant ${payload.data.saccoCode}. Opening SACCO dashboard...`);
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start tenant session");
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/platform/assume-tenant", {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to end tenant session");
      }
      setMessage("Tenant support session ended.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to end tenant session");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Assume Tenant (Support Mode)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start a time-limited support session as tenant super admin. A banner appears across the dashboard.
      </p>

      {activeAssumption ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Active tenant: {activeAssumption.saccoCode}</p>
          <p className="mt-1 text-xs text-amber-700">Reason: {activeAssumption.reason}</p>
          <button
            type="button"
            disabled={busy}
            onClick={endSession}
            className="mt-3 rounded-md border border-amber-300 px-3 py-1.5 text-xs text-amber-800"
          >
            {busy ? "Ending..." : "End support session"}
          </button>
        </div>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={startSession}>
          <select
            value={saccoCode}
            onChange={(event) => setSaccoCode(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {sortedTenants.map((tenant) => (
              <option key={tenant.code} value={tenant.code}>
                {tenant.code} - {tenant.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={240}
            placeholder="Reason for assuming tenant"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={busy || !saccoCode}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            {busy ? "Starting..." : "Start support session"}
          </button>
        </form>
      )}

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
