"use client";

import { useState, useTransition } from "react";

type TenantOption = {
  saccoId: string;
  saccoCode: string;
  saccoName: string;
  role: string;
};

export function TenantSwitcher({
  tenants,
  activeSaccoId,
}: {
  tenants: TenantOption[];
  activeSaccoId: string;
}) {
  const [selected, setSelected] = useState(activeSaccoId);
  const [isPending, startTransition] = useTransition();

  if (tenants.length <= 1) {
    return null;
  }

  const onChange = (nextSaccoId: string) => {
    setSelected(nextSaccoId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/tenants", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ saccoId: nextSaccoId }),
        });
        if (!response.ok) {
          setSelected(activeSaccoId);
          return;
        }
        window.location.reload();
      } catch {
        setSelected(activeSaccoId);
      }
    });
  };

  return (
    <div className="rounded-md border border-border bg-background px-2 py-1">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Organization</p>
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        disabled={isPending}
        className="w-full bg-transparent text-xs"
      >
        {tenants.map((tenant) => (
          <option key={tenant.saccoId} value={tenant.saccoId}>
            {tenant.saccoCode} - {tenant.saccoName}
          </option>
        ))}
      </select>
    </div>
  );
}
