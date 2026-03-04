"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type ShareTransactionRow = {
  id: string;
  memberLabel: string;
  type: "PURCHASE" | "REDEMPTION" | "ADJUSTMENT";
  amount: string;
  note: string | null;
  createdAt: string;
};

export function SharesTransactionsPanel({
  transactions,
}: {
  transactions: ShareTransactionRow[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<"ALL" | "PURCHASE" | "REDEMPTION" | "ADJUSTMENT">("ALL");
  const [sortBy, setSortBy] = useState<"latest" | "highest">("latest");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const toNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = transactions.filter((transaction) => {
      const matchesType =
        typeFilter === "ALL" ? true : transaction.type === typeFilter;
      const haystack = `${transaction.memberLabel} ${transaction.note ?? ""}`.toLowerCase();
      const matchesQuery = normalizedQuery
        ? haystack.includes(normalizedQuery)
        : true;
      const createdAt = new Date(transaction.createdAt);
      const fromOk = fromDate
        ? createdAt.getTime() >= new Date(`${fromDate}T00:00:00`).getTime()
        : true;
      const toOk = toDate
        ? createdAt.getTime() <= new Date(`${toDate}T23:59:59`).getTime()
        : true;
      return matchesType && matchesQuery && fromOk && toOk;
    });

    if (sortBy === "highest") {
      return [...filtered].sort(
        (a, b) => toNumber(b.amount) - toNumber(a.amount),
      );
    }

    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [fromDate, query, sortBy, toDate, transactions, typeFilter]);

  const exportVisibleTransactions = () => {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ["member", "type", "amount", "note", "createdAt"],
      ...visibleTransactions.map((transaction) => [
        transaction.memberLabel,
        transaction.type,
        transaction.amount,
        transaction.note ?? "",
        transaction.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => escape(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shares-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recent Share Transactions</h2>
          <p className="text-sm text-muted-foreground">
            Filter and review member equity movements.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search member or note"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value as
                  | "ALL"
                  | "PURCHASE"
                  | "REDEMPTION"
                  | "ADJUSTMENT",
              )
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All types</option>
            <option value="PURCHASE">Purchases</option>
            <option value="REDEMPTION">Redemptions</option>
            <option value="ADJUSTMENT">Adjustments</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "latest" | "highest")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="latest">Sort: Latest</option>
            <option value="highest">Sort: Highest amount</option>
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
          onClick={exportVisibleTransactions}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleTransactions.map((transaction) => (
          <article
            key={transaction.id}
            className="rounded-lg border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{transaction.memberLabel}</p>
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
                {transaction.type}
              </span>
            </div>
            <p className="mt-2 text-sm">
              Amount: <span className="font-semibold">{formatMoney(transaction.amount)}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Note: {transaction.note ?? "-"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTimeUtc(transaction.createdAt)}
            </p>
          </article>
        ))}
      </div>

      {visibleTransactions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No transactions match this filter.
        </p>
      ) : null}
    </section>
  );
}
