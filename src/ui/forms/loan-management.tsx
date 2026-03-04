"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";

type MemberOption = {
  id: string;
  fullName: string;
  memberNumber: string;
};

type LoanRow = {
  id: string;
  memberId: string;
  memberName: string;
  status: string;
  termMonths: number;
  dueAt: string | null;
  principalAmount: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingPenalty: string;
};

const formatUtcDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export function LoanManagement({
  members,
  loans,
}: {
  members: MemberOption[];
  loans: LoanRow[];
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [termMonths, setTermMonths] = useState("1");
  const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({});
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [loadingApply, setLoadingApply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleApply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingApply(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/loans/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId,
          principalAmount: Number(principalAmount),
          termMonths: Number(termMonths),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to apply loan");
      }

      setMessage("Loan application created.");
      setPrincipalAmount("");
      setTermMonths("1");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected error",
      );
    } finally {
      setLoadingApply(false);
    }
  };

  const callLoanAction = async (
    loanId: string,
    action: "approve" | "disburse" | "repay",
    body?: Record<string, unknown>,
  ) => {
    setBusyLoanId(loanId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/loans/${loanId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? `Failed to ${action} loan`);
      }

      setMessage(`Loan ${action} action successful.`);
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unexpected error",
      );
    } finally {
      setBusyLoanId(null);
    }
  };

  const handleRepay = async (loan: LoanRow) => {
    const rawAmount = repayAmounts[loan.id];
    const amount = Number(rawAmount);
    if (!rawAmount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid repayment amount greater than 0.");
      return;
    }

    await callLoanAction(loan.id, "repay", {
      memberId: loan.memberId,
      amount,
    });
  };

  return (
    <section className="space-y-6">
      <form
        onSubmit={handleApply}
        className="space-y-4 rounded-lg border bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Apply Loan</h2>
        <p className="text-sm text-slate-600">
          Capture a loan request and push it through approval, disbursement, and
          repayment.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.memberNumber} - {member.fullName}
              </option>
            ))}
          </select>
          <input
            type="number"
            required
            min={1}
            step="0.01"
            value={principalAmount}
            onChange={(event) => setPrincipalAmount(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Principal amount"
          />
          <input
            type="number"
            required
            min={1}
            step={1}
            value={termMonths}
            onChange={(event) => setTermMonths(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Term (months)"
          />
        </div>
        <button
          type="submit"
          disabled={loadingApply}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {loadingApply ? "Submitting..." : "Apply Loan"}
        </button>
      </form>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Loans</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loans.map((loan) => (
            <article
              key={loan.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{loan.memberName}</p>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {loan.status}
                </span>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600">
                <p>
                  Principal:{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoney(loan.principalAmount)}
                  </span>
                </p>
                <p>
                  Outstanding P/I/F:{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoney(loan.outstandingPrincipal)} /{" "}
                    {formatMoney(loan.outstandingInterest)} /{" "}
                    {formatMoney(loan.outstandingPenalty)}
                  </span>
                </p>
                <p>
                  Due:{" "}
                  <span className="font-semibold text-foreground">
                    {loan.dueAt ? formatUtcDate(loan.dueAt) : "-"} (
                    {loan.termMonths} months)
                  </span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {loan.status === "PENDING" ? (
                  <button
                    type="button"
                    disabled={busyLoanId === loan.id}
                    onClick={() => callLoanAction(loan.id, "approve")}
                    className="rounded-lg border border-border px-2 py-1"
                  >
                    Approve
                  </button>
                ) : null}
                {loan.status === "APPROVED" ? (
                  <button
                    type="button"
                    disabled={busyLoanId === loan.id}
                    onClick={() => callLoanAction(loan.id, "disburse")}
                    className="rounded-lg border border-border px-2 py-1"
                  >
                    Disburse
                  </button>
                ) : null}
                {["ACTIVE", "DISBURSED"].includes(loan.status) ? (
                  <>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={repayAmounts[loan.id] ?? ""}
                      onChange={(event) =>
                        setRepayAmounts((prev) => ({
                          ...prev,
                          [loan.id]: event.target.value,
                        }))
                      }
                      className="w-28 rounded border border-border bg-background px-2 py-1"
                      placeholder="Repay"
                    />
                    <button
                      type="button"
                      disabled={busyLoanId === loan.id}
                      onClick={() => handleRepay(loan)}
                      className="rounded-lg border border-border px-2 py-1"
                    >
                      Repay
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
          {loans.length === 0 ? (
            <p className="text-sm text-slate-500">No loans recorded yet.</p>
          ) : null}
        </div>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
