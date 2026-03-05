"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type RequestRow = {
  id: string;
  type: string;
  amount: string;
  status: string;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function MemberRequestsAdminPanel({
  requests,
  canReview,
}: {
  requests: RequestRow[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/member/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to update request status");
      }
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review request");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Member Self-Service Requests</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review withdrawal and share-redemption requests submitted by this member.
      </p>
      <div className="mt-3 space-y-2">
        {requests.map((request) => (
          <article key={request.id} className="rounded-md border bg-background px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{request.type}</p>
              <span className="rounded-full border px-2 py-0.5 text-xs">{request.status}</span>
            </div>
            <p className="mt-1 text-sm">Amount: {formatMoney(request.amount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Submitted: {formatDateTimeUtc(request.createdAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Note: {request.note ?? "-"}</p>
            {request.reviewedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Reviewed: {formatDateTimeUtc(request.reviewedAt)} {request.reviewNote ? `| ${request.reviewNote}` : ""}
              </p>
            ) : null}

            {canReview && request.status === "PENDING" ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => review(request.id, "APPROVED")}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => review(request.id, "REJECTED")}
                  className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No self-service requests found for this member.</p>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
