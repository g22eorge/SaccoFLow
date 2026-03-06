"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actorName: string;
  actorRole: string | null;
  beforeJson: string | null;
  afterJson: string | null;
};

const severityOf = (row: AuditRow): "High" | "Medium" | "Low" => {
  const highActions = [
    "DELETE",
    "ROLLBACK",
    "RESET_PASSWORD",
    "CHANGE_PASSWORD",
    "TERMINATE_SESSION",
  ];
  if (highActions.includes(row.action)) return "High";
  if (row.entity === "Loan" || row.entity === "LoanRepayment" || row.entity === "LoanApprovalMatrixState") return "Medium";
  return "Low";
};

const parseJson = (value: string | null) => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const pretty = (value: unknown) => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const primaryEntityId = (value: string) => value.split(":")[0] ?? value;

const relatedHref = (row: AuditRow) => {
  const id = primaryEntityId(row.entityId);
  if (row.entity === "Member" || row.entity === "MemberRequest") {
    return `/dashboard/members/${id}`;
  }
  if (
    row.entity === "Loan" ||
    row.entity === "LoanRepayment" ||
    row.entity === "LoanScheduleApproval" ||
    row.entity === "LoanApprovalMatrixState" ||
    row.entity === "LoanApprovalMatrixStep" ||
    row.entity === "CollectionAction"
  ) {
    return `/dashboard/loans`;
  }
  if (row.entity === "AppUser") {
    return "/users";
  }
  if (row.entity === "AppSetting" || row.entity === "AccountProfile" || row.entity === "AccountSecurity") {
    return "/dashboard/settings";
  }
  return null;
};

export function AuditLogsPanel({
  logs,
  canExport = true,
}: {
  logs: AuditRow[];
  canExport?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "CREATE" | "UPDATE" | "DELETE">("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "High" | "Medium" | "Low">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activePreset, setActivePreset] = useState<"ALL" | "SECURITY" | "APPROVALS" | "SETTINGS" | "COLLECTIONS">("ALL");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((row) => {
      const matchesPreset =
        activePreset === "ALL"
          ? true
          : activePreset === "SECURITY"
            ? ["RESET_PASSWORD", "CHANGE_PASSWORD", "TERMINATE_SESSION", "PLATFORM_PROFILE_UPDATE"].includes(row.action)
            : activePreset === "APPROVALS"
              ? row.entity.includes("Loan") || row.action.includes("APPROVE")
              : activePreset === "SETTINGS"
                ? row.entity === "AppSetting"
                : row.entity === "CollectionAction";
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
      return matchesPreset && matchesAction && matchesSeverity && matchesQuery && fromOk && toOk;
    });
  }, [actionFilter, activePreset, fromDate, logs, query, severityFilter, toDate]);

  const selectedLog = visibleLogs.find((entry) => entry.id === selectedLogId) ?? visibleLogs[0] ?? null;

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

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
        {canExport ? (
          <button
            type="button"
            onClick={exportVisible}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Export CSV
          </button>
        ) : (
          <span className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
            Export restricted for this role
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["ALL", "All"],
          ["SECURITY", "Security"],
          ["APPROVALS", "Approvals"],
          ["SETTINGS", "Settings"],
          ["COLLECTIONS", "Collections"],
        ] as const).map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            onClick={() => setActivePreset(preset)}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              activePreset === preset
                ? "border-[#cc5500] bg-orange-50 text-[#cc5500]"
                : "border-border"
            }`}
          >
            {label}
          </button>
        ))}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("CARDS")}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              viewMode === "CARDS"
                ? "border-[#cc5500] bg-orange-50 text-[#cc5500]"
                : "border-border"
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("TABLE")}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              viewMode === "TABLE"
                ? "border-[#cc5500] bg-orange-50 text-[#cc5500]"
                : "border-border"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={viewMode === "CARDS" ? "grid gap-3 md:grid-cols-2" : "overflow-x-auto rounded-lg border"}>
          {viewMode === "CARDS"
            ? visibleLogs.map((entry) => {
          const severity = severityOf(entry);
          const severityClass =
            severity === "High"
              ? "text-red-700 bg-red-50"
              : severity === "Medium"
                ? "text-amber-700 bg-amber-50"
                : "text-emerald-700 bg-emerald-50";
          return (
            <article
              key={entry.id}
              className={`cursor-pointer rounded-lg border bg-background p-4 ${selectedLogId === entry.id ? "border-[#cc5500]" : ""}`}
              onClick={() => setSelectedLogId(entry.id)}
            >
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
              {entry.actorRole ? (
                <p className="mt-1 text-xs text-muted-foreground">Role: {entry.actorRole}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">Entity ID: {entry.entityId}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTimeUtc(entry.createdAt)}
              </p>
            </article>
          );
          })
            : (
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Entity ID</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map((entry) => {
                    const severity = severityOf(entry);
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedLogId(entry.id)}
                        className={`cursor-pointer border-t ${
                          selectedLogId === entry.id ? "bg-orange-50/60" : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-3 py-2 text-xs">{formatDateTimeUtc(entry.createdAt)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              severity === "High"
                                ? "bg-red-50 text-red-700"
                                : severity === "Medium"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {severity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold">{entry.action}</td>
                        <td className="px-3 py-2 text-xs">{entry.entity}</td>
                        <td className="px-3 py-2 text-xs">{entry.actorName}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{entry.entityId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>

        <aside className="rounded-lg border bg-background p-4">
          <h3 className="text-sm font-semibold">Event Details</h3>
          {selectedLog ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-md border p-3 text-xs">
                <p><span className="font-semibold">Action:</span> {selectedLog.action}</p>
                <p className="mt-1"><span className="font-semibold">Entity:</span> {selectedLog.entity}</p>
                <p className="mt-1"><span className="font-semibold">Actor:</span> {selectedLog.actorName}</p>
                <p className="mt-1"><span className="font-semibold">Time:</span> {formatDateTimeUtc(selectedLog.createdAt)}</p>
                <p className="mt-1"><span className="font-semibold">Event ID:</span> {selectedLog.id}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText("Event ID", selectedLog.id)}
                    className="rounded-md border px-2 py-1 text-[11px]"
                  >
                    Copy Event ID
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(
                        "After JSON",
                        pretty(parseJson(selectedLog.afterJson)),
                      )
                    }
                    className="rounded-md border px-2 py-1 text-[11px]"
                  >
                    Copy After JSON
                  </button>
                  {relatedHref(selectedLog) ? (
                    <Link
                      href={relatedHref(selectedLog) as string}
                      className="rounded-md border px-2 py-1 text-[11px] text-[#cc5500]"
                    >
                      Open Related Record
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold">Before</p>
                <pre className="mt-1 max-h-52 overflow-auto text-[11px] text-muted-foreground">
                  {pretty(parseJson(selectedLog.beforeJson))}
                </pre>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold">After</p>
                <pre className="mt-1 max-h-52 overflow-auto text-[11px] text-muted-foreground">
                  {pretty(parseJson(selectedLog.afterJson))}
                </pre>
              </div>
              {copyMessage ? (
                <p className="text-xs text-muted-foreground">{copyMessage}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Select an event to inspect details.</p>
          )}
        </aside>
      </div>

      {visibleLogs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No audit logs match this filter.</p>
      ) : null}
    </section>
  );
}
