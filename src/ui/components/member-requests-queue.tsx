"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type QueueRow = {
  id: string;
  memberLabel: string;
  type: string;
  amount: string;
  status: string;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function MemberRequestsQueue({
  requests,
  canReview,
}: {
  requests: QueueRow[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : request.status === statusFilter;
      const haystack = `${request.memberLabel} ${request.type} ${request.note ?? ""}`.toLowerCase();
      const matchesQuery = q ? haystack.includes(q) : true;
      return matchesStatus && matchesQuery;
    });
  }, [query, requests, statusFilter]);

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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Member Requests Queue</h2>
          <p className="text-sm text-muted-foreground">
            Review savings withdrawal and share redemption requests across all members.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search member or type"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | "PENDING" | "APPROVED" | "REJECTED")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((request) => (
          <article key={request.id} className="rounded-md border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{request.memberLabel}</p>
              <span className="rounded-full border px-2 py-0.5 text-xs">{request.status}</span>
            </div>
            <p className="mt-1 text-sm">{request.type}</p>
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
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No requests match this filter.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
