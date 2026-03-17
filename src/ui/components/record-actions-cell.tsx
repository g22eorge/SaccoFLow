"use client";

import Link from "next/link";
import { useState } from "react";

export function RecordActionsCell({
  viewHref,
  viewLabel = "View",
  copyItems = [],
}: {
  viewHref?: string;
  viewLabel?: string;
  copyItems?: Array<{ label: string; value: string | null | undefined }>;
}) {
  const [message, setMessage] = useState<string | null>(null);

  const copyValue = async (label: string, value: string | null | undefined) => {
    if (!value) {
      setMessage(`${label} unavailable`);
      window.setTimeout(() => setMessage(null), 1500);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied`);
      window.setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage("Copy failed");
      window.setTimeout(() => setMessage(null), 1500);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {viewHref ? (
          <Link href={viewHref} className="rounded border border-border px-2 py-1 text-[11px]">
            {viewLabel}
          </Link>
        ) : null}
        {copyItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => void copyValue(item.label, item.value)}
            className="rounded border border-border px-2 py-1 text-[11px]"
          >
            Copy {item.label}
          </button>
        ))}
      </div>
      {message ? <p className="mt-1 text-[10px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
