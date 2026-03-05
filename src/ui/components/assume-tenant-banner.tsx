"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssumeTenantBanner({
  saccoCode,
  reason,
}: {
  saccoCode: string;
  reason: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const endSession = async () => {
    setBusy(true);
    try {
      await fetch("/api/platform/assume-tenant", { method: "DELETE" });
      router.push("/platform");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          Support mode active for <span className="font-semibold">{saccoCode}</span> | Reason: {reason}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={endSession}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs"
        >
          {busy ? "Ending..." : "End session"}
        </button>
      </div>
    </div>
  );
}
