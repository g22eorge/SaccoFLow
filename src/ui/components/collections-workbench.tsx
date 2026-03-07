"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type CollectionCase = {
  loanId: string;
  memberName: string;
  status: string;
  dueAt: string | null;
  daysToDue: number | null;
  exposure: string;
  severity: "High" | "Medium" | "Watch";
  reason: string;
  recommendation: string;
  lastActionAt: string | null;
  lastActionType: string | null;
  lastActionOutcome: string | null;
  nextFollowUpAt: string | null;
};

export function CollectionsWorkbench({ cases }: { cases: CollectionCase[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"ALL" | "High" | "Medium" | "Watch">("ALL");
  const [actionType, setActionType] = useState<
    "CALL" | "SMS" | "VISIT" | "PROMISE_TO_PAY" | "RESTRUCTURE_REVIEW" | "ESCALATION"
  >("CALL");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState(cases[0]?.loanId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("TABLE");

  const visibleCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((entry) => {
      const severityPass = severity === "ALL" ? true : entry.severity === severity;
      const queryPass =
        q.length === 0
          ? true
          : `${entry.memberName} ${entry.loanId} ${entry.reason}`.toLowerCase().includes(q);
      return severityPass && queryPass;
    });
  }, [cases, query, severity]);

  const submitAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/collections/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanId: selectedLoanId,
          actionType,
          outcome,
          note: note || undefined,
          nextFollowUpAt: nextFollowUpAt
            ? new Date(nextFollowUpAt).toISOString()
            : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to record collection action");
      }
      setMessage("Collection action recorded.");
      setOutcome("");
      setNote("");
      setNextFollowUpAt("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record collection action");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Collections Queue</h2>
            <p className="text-sm text-muted-foreground">
              Prioritize overdue and near-risk cases with daily action tracking.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search member or loan"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as "ALL" | "High" | "Medium" | "Watch")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All severities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Watch">Watch</option>
            </select>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                viewMode === "TABLE" ? "border-[#cc5500] bg-orange-50 text-[#cc5500]" : "border-border"
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                viewMode === "CARDS" ? "border-[#cc5500] bg-orange-50 text-[#cc5500]" : "border-border"
              }`}
            >
              Cards
            </button>
          </div>
        </div>

        {viewMode === "CARDS" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleCases.map((entry) => (
              <article key={entry.loanId} className="rounded-md border bg-background px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{entry.memberName}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      entry.severity === "High"
                        ? "bg-red-50 text-red-700"
                        : entry.severity === "Medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {entry.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Loan {entry.loanId.slice(0, 8)} | {entry.status}</p>
                <p className="mt-1 text-sm">Exposure: {formatMoney(entry.exposure)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Signal: {entry.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">Action: {entry.recommendation}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Due: {entry.dueAt ? formatDateTimeUtc(entry.dueAt) : "-"}
                </p>
                {entry.lastActionAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last action: {entry.lastActionType} on {formatDateTimeUtc(entry.lastActionAt)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">No action logged yet.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="min-w-[25ch] px-3 py-2">Member</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Exposure</th>
                  <th className="px-3 py-2">Signal</th>
                  <th className="px-3 py-2">Recommended Action</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Last Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((entry) => (
                  <tr key={entry.loanId} className="border-t hover:bg-muted/40">
                    <td className="min-w-[25ch] px-3 py-2 text-xs">{entry.memberName}</td>
                    <td className="px-3 py-2 text-xs font-semibold">{entry.severity}</td>
                    <td className="px-3 py-2 text-xs">{formatMoney(entry.exposure)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{entry.reason}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{entry.recommendation}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {entry.dueAt ? formatDateTimeUtc(entry.dueAt) : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {entry.lastActionAt
                        ? `${entry.lastActionType ?? "ACTION"} | ${formatDateTimeUtc(entry.lastActionAt)}`
                        : "No action"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCases.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No collection cases match this filter.</p>
        ) : null}
      </section>

      <form onSubmit={submitAction} className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Record Collection Action</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Log outreach and follow-up commitments for collections governance.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={selectedLoanId}
            onChange={(event) => setSelectedLoanId(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {cases.map((entry) => (
              <option key={entry.loanId} value={entry.loanId}>
                {entry.memberName} - {entry.loanId.slice(0, 8)}
              </option>
            ))}
          </select>
          <select
            value={actionType}
            onChange={(event) =>
              setActionType(
                event.target.value as
                  | "CALL"
                  | "SMS"
                  | "VISIT"
                  | "PROMISE_TO_PAY"
                  | "RESTRUCTURE_REVIEW"
                  | "ESCALATION",
              )
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="CALL">Call</option>
            <option value="SMS">SMS</option>
            <option value="VISIT">Visit</option>
            <option value="PROMISE_TO_PAY">Promise to Pay</option>
            <option value="RESTRUCTURE_REVIEW">Restructure Review</option>
            <option value="ESCALATION">Escalation</option>
          </select>
          <input
            type="text"
            required
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Outcome summary"
          />
          <input
            type="datetime-local"
            value={nextFollowUpAt}
            onChange={(event) => setNextFollowUpAt(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-3 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Optional note"
        />
        <button
          type="submit"
          disabled={busy || !selectedLoanId}
          className="mt-3 rounded-lg border border-border px-3 py-2 text-sm"
        >
          {busy ? "Recording..." : "Record Action"}
        </button>
        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </form>
    </section>
  );
}
