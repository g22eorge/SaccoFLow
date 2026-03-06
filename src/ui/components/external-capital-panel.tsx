"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type CapitalRow = {
  id: string;
  type: string;
  amount: string;
  baseAmount: string;
  currency: string;
  fxRate: string;
  status: string;
  verificationLevel: string;
  amlFlag: boolean;
  isLargeInflow: boolean;
  source: string;
  allocationBucket: string | null;
  reference: string | null;
  documentUrl: string | null;
  note: string | null;
  correctionOfId: string | null;
  receivedAt: string;
};

export function ExternalCapitalPanel({
  rows,
  canCreate,
  canManage,
}: {
  rows: CapitalRow[];
  canCreate: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DONATION" | "GRANT" | "EXTERNAL_FUNDING" | "ADJUSTMENT" | "REVERSAL" | "OTHER">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RECORDED" | "VERIFIED" | "POSTED">("ALL");

  const [type, setType] = useState<"DONATION" | "GRANT" | "EXTERNAL_FUNDING" | "ADJUSTMENT" | "OTHER">("DONATION");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [fxRate, setFxRate] = useState("1");
  const [source, setSource] = useState("");
  const [allocationBucket, setAllocationBucket] = useState("");
  const [reference, setReference] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [note, setNote] = useState("");
  const [receivedAt, setReceivedAt] = useState("");

  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [selectedCorrectionId, setSelectedCorrectionId] = useState(rows[0]?.id ?? "");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const typePass = typeFilter === "ALL" ? true : row.type === typeFilter;
      const statusPass = statusFilter === "ALL" ? true : row.status === statusFilter;
      const queryPass =
        q.length === 0
          ? true
          : `${row.source} ${row.reference ?? ""} ${row.type} ${row.status}`
              .toLowerCase()
              .includes(q);
      return typePass && statusPass && queryPass;
    });
  }, [rows, query, statusFilter, typeFilter]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/external-capital", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          amount: Number(amount),
          currency,
          fxRate: Number(fxRate),
          source,
          allocationBucket: allocationBucket || undefined,
          reference: reference || undefined,
          documentUrl: documentUrl || undefined,
          note: note || undefined,
          receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to record external capital");
      }
      setAmount("");
      setSource("");
      setAllocationBucket("");
      setReference("");
      setDocumentUrl("");
      setNote("");
      setReceivedAt("");
      setMessage("External capital transaction recorded.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record external capital");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: "RECORDED" | "VERIFIED" | "POSTED") => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/external-capital/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to update status");
      }
      setMessage(`Status updated to ${status}.`);
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update status");
    } finally {
      setBusy(false);
    }
  };

  const correctEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCorrectionId) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/external-capital/${selectedCorrectionId}/correct`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: correctionReason,
          amount: correctionAmount ? Number(correctionAmount) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to create correction");
      }
      setCorrectionReason("");
      setCorrectionAmount("");
      setMessage("Correction posted successfully.");
      router.refresh();
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : "Unable to create correction");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      {canCreate ? (
        <form onSubmit={submit} className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Record Donation / External Capital</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="DONATION">Donation</option>
              <option value="GRANT">Grant</option>
              <option value="EXTERNAL_FUNDING">External Funding</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OTHER">Other</option>
            </select>
            <input value={source} onChange={(e) => setSource(e.target.value)} required placeholder="Source / donor" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="Amount" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="Currency" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" min={0.0001} step="0.0001" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder="FX rate" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={allocationBucket} onChange={(e) => setAllocationBucket(e.target.value)} placeholder="Allocation bucket" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="Document URL" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={busy} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
            {busy ? "Saving..." : "Record External Capital"}
          </button>
        </form>
      ) : null}

      {canManage ? (
        <form onSubmit={correctEntry} className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Correction Flow</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create reversal (full) or adjustment (partial) with mandatory reason.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select value={selectedCorrectionId} onChange={(e) => setSelectedCorrectionId(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {rows.map((row) => (
                <option key={row.id} value={row.id}>{row.type} | {row.source} | {formatMoney(row.baseAmount)}</option>
              ))}
            </select>
            <input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} required placeholder="Correction reason" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" min={0} step="0.01" value={correctionAmount} onChange={(e) => setCorrectionAmount(e.target.value)} placeholder="Adjustment amount (optional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={busy} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">Post correction</button>
        </form>
      ) : null}

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search source/ref" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="ALL">All types</option>
            <option value="DONATION">Donation</option>
            <option value="GRANT">Grant</option>
            <option value="EXTERNAL_FUNDING">External Funding</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="REVERSAL">Reversal</option>
            <option value="OTHER">Other</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="RECORDED">Recorded</option>
            <option value="VERIFIED">Verified</option>
            <option value="POSTED">Posted</option>
          </select>
        </div>

        <h2 className="text-lg font-semibold">Recent External Capital</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((row) => (
            <article key={row.id} className="rounded-md border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{row.type}</p>
                <p className="text-sm font-semibold">{formatMoney(row.baseAmount)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Status: {row.status} | KYC: {row.verificationLevel}</p>
              <p className="mt-1 text-xs text-muted-foreground">Source: {row.source}</p>
              <p className="mt-1 text-xs text-muted-foreground">Amount: {row.currency} {formatMoney(row.amount)} @ {row.fxRate}</p>
              {row.allocationBucket ? <p className="mt-1 text-xs text-muted-foreground">Allocation: {row.allocationBucket}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">Received: {formatDateTimeUtc(row.receivedAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Flags: {row.amlFlag ? "AML" : "None"}{row.isLargeInflow ? " | Large inflow" : ""}
              </p>
              {row.documentUrl ? (
                <a href={row.documentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-[#cc5500]">
                  Open document
                </a>
              ) : null}
              {canManage ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void updateStatus(row.id, "VERIFIED")} className="rounded-md border px-2 py-1 text-xs">Verify</button>
                  <button type="button" disabled={busy} onClick={() => void updateStatus(row.id, "POSTED")} className="rounded-md border px-2 py-1 text-xs">Post</button>
                </div>
              ) : null}
            </article>
          ))}
          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No external capital records match the current filter.</p>
          ) : null}
        </div>
      </section>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
