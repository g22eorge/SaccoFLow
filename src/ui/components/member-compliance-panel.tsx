"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { formatMoney } from "@/src/lib/money";

type KycRow = {
  id: string;
  documentType: string;
  documentNumber: string | null;
  documentUrl: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  notes: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

type BeneficiaryRow = {
  id: string;
  fullName: string;
  relationship: string;
  phone: string | null;
  allocationPercent: string;
  isPrimary: boolean;
};

type ExitCaseRow = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";
  reason: string | null;
  notes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  completedAt: string | null;
};

export function MemberCompliancePanel({
  memberId,
  canManage,
  kycRecords,
  beneficiaries,
  exitCases,
  guaranteedExposure,
}: {
  memberId: string;
  canManage: boolean;
  kycRecords: KycRow[];
  beneficiaries: BeneficiaryRow[];
  exitCases: ExitCaseRow[];
  guaranteedExposure: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitKyc = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/members/${memberId}/kyc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentType: form.get("documentType"),
          documentNumber: form.get("documentNumber") || undefined,
          documentUrl: form.get("documentUrl") || undefined,
          notes: form.get("kycNotes") || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to save KYC record");
      }
      setMessage("KYC record saved.");
      event.currentTarget.reset();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save KYC record");
    } finally {
      setBusy(false);
    }
  };

  const submitBeneficiary = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/members/${memberId}/beneficiaries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("beneficiaryName"),
          relationship: form.get("beneficiaryRelationship"),
          phone: form.get("beneficiaryPhone") || undefined,
          allocationPercent: Number(form.get("beneficiaryAllocation") || 0),
          isPrimary: form.get("beneficiaryPrimary") === "on",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to save beneficiary");
      }
      setMessage("Beneficiary saved.");
      event.currentTarget.reset();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save beneficiary");
    } finally {
      setBusy(false);
    }
  };

  const submitExitCase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/members/${memberId}/exit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: form.get("exitReason") || undefined,
          notes: form.get("exitNotes") || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to open exit case");
      }
      setMessage("Exit case opened.");
      event.currentTarget.reset();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to open exit case");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Compliance, Beneficiary & Exit</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Track member KYC, beneficiaries, guarantee exposure, and exit requests.
      </p>

      <div className="mt-3 rounded-md border bg-background px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Guarantee Exposure</p>
        <p className="mt-1 text-lg font-semibold">{formatMoney(guaranteedExposure)}</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm font-semibold">KYC Records</p>
          {kycRecords.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No KYC records.</p> : null}
          <div className="mt-2 space-y-2">
            {kycRecords.map((row) => (
              <article key={row.id} className="rounded border px-3 py-2 text-xs">
                <p className="font-medium">{row.documentType} • {row.status}</p>
                <p className="text-muted-foreground">{row.documentNumber ?? "No document number"}</p>
                <p className="text-muted-foreground">Added {formatDateTimeUtc(row.createdAt)}</p>
              </article>
            ))}
          </div>
          {canManage ? (
            <form className="mt-3 space-y-2" onSubmit={submitKyc}>
              <input name="documentType" placeholder="Document type" className="w-full rounded border px-2 py-1 text-sm" required />
              <input name="documentNumber" placeholder="Document number" className="w-full rounded border px-2 py-1 text-sm" />
              <input name="documentUrl" placeholder="Document URL" className="w-full rounded border px-2 py-1 text-sm" />
              <input name="kycNotes" placeholder="Notes" className="w-full rounded border px-2 py-1 text-sm" />
              <button type="submit" disabled={busy} className="rounded border px-3 py-1 text-xs">Add KYC</button>
            </form>
          ) : null}
        </div>

        <div className="rounded-md border bg-background p-4">
          <p className="text-sm font-semibold">Beneficiaries</p>
          {beneficiaries.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No beneficiaries recorded.</p> : null}
          <div className="mt-2 space-y-2">
            {beneficiaries.map((row) => (
              <article key={row.id} className="rounded border px-3 py-2 text-xs">
                <p className="font-medium">{row.fullName} {row.isPrimary ? "(Primary)" : ""}</p>
                <p className="text-muted-foreground">{row.relationship} • {row.allocationPercent}%</p>
              </article>
            ))}
          </div>
          {canManage ? (
            <form className="mt-3 space-y-2" onSubmit={submitBeneficiary}>
              <input name="beneficiaryName" placeholder="Full name" className="w-full rounded border px-2 py-1 text-sm" required />
              <input name="beneficiaryRelationship" placeholder="Relationship" className="w-full rounded border px-2 py-1 text-sm" required />
              <input name="beneficiaryPhone" placeholder="Phone" className="w-full rounded border px-2 py-1 text-sm" />
              <input name="beneficiaryAllocation" type="number" min={1} max={100} placeholder="Allocation %" className="w-full rounded border px-2 py-1 text-sm" required />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="beneficiaryPrimary" /> Primary beneficiary</label>
              <button type="submit" disabled={busy} className="rounded border px-3 py-1 text-xs">Add Beneficiary</button>
            </form>
          ) : null}
        </div>

        <div className="rounded-md border bg-background p-4">
          <p className="text-sm font-semibold">Exit Cases</p>
          {exitCases.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No exit cases.</p> : null}
          <div className="mt-2 space-y-2">
            {exitCases.map((row) => (
              <article key={row.id} className="rounded border px-3 py-2 text-xs">
                <p className="font-medium">{row.status}</p>
                <p className="text-muted-foreground">Requested {formatDateTimeUtc(row.requestedAt)}</p>
              </article>
            ))}
          </div>
          {canManage ? (
            <form className="mt-3 space-y-2" onSubmit={submitExitCase}>
              <input name="exitReason" placeholder="Exit reason" className="w-full rounded border px-2 py-1 text-sm" />
              <input name="exitNotes" placeholder="Notes" className="w-full rounded border px-2 py-1 text-sm" />
              <button type="submit" disabled={busy} className="rounded border px-3 py-1 text-xs">Open Exit Case</button>
            </form>
          ) : null}
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
