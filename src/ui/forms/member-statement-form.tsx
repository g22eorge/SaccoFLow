"use client";

import { useState } from "react";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type MemberOption = {
  id: string;
  fullName: string;
  memberNumber: string;
  shareBalance: string;
};

type StatementEvent = {
  id: string;
  date: string;
  type: string;
  amount: string;
  note: string | null;
};

type StatementPayload = {
  member: {
    id: string;
    fullName: string;
    memberNumber: string;
  };
  openingSavings: string;
  closingSavings: string;
  totals: {
    deposits: string;
    withdrawals: string;
    repayments: string;
  };
  events: StatementEvent[];
};

export function MemberStatementForm({ members }: { members: MemberOption[] }) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<StatementPayload | null>(null);

  const fetchStatement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ memberId });
      if (fromDate) {
        params.set("from", `${fromDate}T00:00:00.000Z`);
      }
      if (toDate) {
        params.set("to", `${toDate}T23:59:59.999Z`);
      }

      const response = await fetch(
        `/api/reports/member-statement?${params.toString()}`,
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error?.message ?? "Failed to load member statement",
        );
      }

      setStatement(payload.data as StatementPayload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unexpected error",
      );
      setStatement(null);
    } finally {
      setLoading(false);
    }
  };

  const buildParams = () => {
    const params = new URLSearchParams({ memberId });
    if (fromDate) {
      params.set("from", `${fromDate}T00:00:00.000Z`);
    }
    if (toDate) {
      params.set("to", `${toDate}T23:59:59.999Z`);
    }
    return params;
  };

  const exportCsv = () => {
    const params = buildParams();
    window.location.href = `/api/reports/member-statement/export?${params.toString()}`;
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Member Statement</h2>
      <p className="text-sm text-slate-600">
        Generate period-based statements and export them to CSV.
      </p>
      <form className="grid gap-3 md:grid-cols-5" onSubmit={fetchStatement}>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.memberNumber} - {member.fullName} (Shares: {formatMoney(member.shareBalance)})
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <input
          type="date"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !memberId}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {loading ? "Loading..." : "Generate"}
        </button>
        <button
          type="button"
          disabled={!statement || !memberId}
          onClick={exportCsv}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Download CSV
        </button>
      </form>

      {statement ? (
        <div className="space-y-4 rounded-xl border border-border/70 bg-background p-4">
          <div>
            <p className="text-sm text-slate-500">Member</p>
            <p className="font-semibold">
              {statement.member.memberNumber} - {statement.member.fullName}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <p className="rounded-lg border border-border/70 p-3 text-sm">
              Opening savings:{" "}
              <span className="font-semibold">
                {formatMoney(statement.openingSavings)}
              </span>
            </p>
            <p className="rounded-lg border border-border/70 p-3 text-sm">
              Deposits:{" "}
              <span className="font-semibold">
                {formatMoney(statement.totals.deposits)}
              </span>
            </p>
            <p className="rounded-lg border border-border/70 p-3 text-sm">
              Withdrawals:{" "}
              <span className="font-semibold">
                {formatMoney(statement.totals.withdrawals)}
              </span>
            </p>
            <p className="rounded-lg border border-border/70 p-3 text-sm">
              Loan repayments:{" "}
              <span className="font-semibold">
                {formatMoney(statement.totals.repayments)}
              </span>
            </p>
            <p className="rounded-lg border border-border/70 p-3 text-sm">
              Closing savings:{" "}
              <span className="font-semibold">
                {formatMoney(statement.closingSavings)}
              </span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="space-y-3 md:hidden">
              {statement.events.map((entry) => (
                <article
                  key={`${entry.type}-${entry.id}-${entry.date}-mobile`}
                  className="rounded-xl border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold">
                      {entry.type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTimeUtc(entry.date)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    Amount:{" "}
                    <span className="font-semibold">
                      {formatMoney(entry.amount)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Note: {entry.note ?? "-"}
                  </p>
                </article>
              ))}
              {statement.events.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No statement events in selected range.
                </p>
              ) : null}
            </div>

            <table className="hidden w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {statement.events.map((entry) => (
                  <tr
                    key={`${entry.type}-${entry.id}-${entry.date}`}
                    className="border-b border-border/70"
                  >
                    <td className="px-2 py-2">
                      {formatDateTimeUtc(entry.date)}
                    </td>
                    <td className="px-2 py-2">{entry.type}</td>
                    <td className="px-2 py-2">{formatMoney(entry.amount)}</td>
                    <td className="px-2 py-2">{entry.note ?? "-"}</td>
                  </tr>
                ))}
                {statement.events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-slate-500">
                      No statement events in selected range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
