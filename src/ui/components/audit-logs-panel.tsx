"use client";

import { useMemo, useState } from "react";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actorName: string;
};

const severityOf = (row: AuditRow): "High" | "Medium" | "Low" => {
  if (row.action === "DELETE") return "High";
  if (row.entity === "Loan" || row.entity === "LoanRepayment") return "Medium";
  return "Low";
};

export function AuditLogsPanel({ logs }: { logs: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "CREATE" | "UPDATE" | "DELETE">("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "High" | "Medium" | "Low">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((row) => {
      const matchesAction = actionFilter === "ALL" ? true : row.action === actionFilter;
      const severity = severityOf(row);
      const matchesSeverity = severityFilter === "ALL" ? true : severity === severityFilter;
      const haystack = `${row.entity} ${row.entityId} ${row.actorName}`.toLowerCase();
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;
      const createdAt = new Date(row.createdAt);
      const fromOk = fromDate
        ? createdAt.getTime() >= new Date(`${fromDate}T00:00:00`).getTime()
        : true;
      const toOk = toDate
        ? createdAt.getTime() <= new Date(`${toDate}T23:59:59`).getTime()
        : true;
      return matchesAction && matchesSeverity && matchesQuery && fromOk && toOk;
    });
  }, [actionFilter, fromDate, logs, query, severityFilter, toDate]);

  const exportVisible = () => {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ["createdAt", "severity", "action", "entity", "entityId", "actor"],
      ...visibleLogs.map((row) => [
        row.createdAt,
        severityOf(row),
        row.action,
        row.entity,
        row.entityId,
        row.actorName,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => escape(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">
            Filter by action, severity, date, or actor and export current view.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actor/entity"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={actionFilter}
            onChange={(event) =>
              setActionFilter(event.target.value as "ALL" | "CREATE" | "UPDATE" | "DELETE")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
          <select
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(event.target.value as "ALL" | "High" | "Medium" | "Low")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={exportVisible}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleLogs.map((entry) => {
          const severity = severityOf(entry);
          const severityClass =
            severity === "High"
              ? "text-red-700 bg-red-50"
              : severity === "Medium"
                ? "text-amber-700 bg-amber-50"
                : "text-emerald-700 bg-emerald-50";
          return (
            <article key={entry.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
                  {entry.action}
                </span>
                <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
                  {entry.entity}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass}`}>
                  {severity}
                </span>
              </div>
              <p className="mt-2 text-sm">Actor: {entry.actorName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Entity ID: {entry.entityId}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTimeUtc(entry.createdAt)}
              </p>
            </article>
          );
        })}
      </div>

      {visibleLogs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No audit logs match this filter.</p>
      ) : null}
    </section>
  );
}
