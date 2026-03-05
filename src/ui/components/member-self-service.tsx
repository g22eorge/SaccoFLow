"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { formatMoney } from "@/src/lib/money";

type RequestRow = {
  id: string;
  type: string;
  amount: string;
  status: string;
  note: string | null;
  createdAt: string;
};

type PendingLoanSchedule = {
  id: string;
  principalAmount: string;
  interestAmount: string;
  termMonths: number;
  schedule: Array<{
    installmentNumber: number;
    dueAt: string;
    principal: string;
    interest: string;
    total: string;
  }>;
};

type LoanProductOption = {
  id: string;
  name: string;
  minPrincipal: string;
  maxPrincipal: string;
  minTermMonths: number;
  maxTermMonths: number;
  repaymentFrequency: string;
};

const statusChipClass = (status: string) => {
  if (status === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
};

const requestTypeLabel = (type: string) => {
  if (type === "SAVINGS_WITHDRAWAL") {
    return "Savings Withdrawal";
  }
  if (type === "SHARE_REDEMPTION") {
    return "Share Redemption";
  }
  return type;
};

export function MemberSelfService({
  requests,
  loansPendingScheduleApproval,
  loanProducts,
}: {
  requests: RequestRow[];
  loansPendingScheduleApproval: PendingLoanSchedule[];
  loanProducts: LoanProductOption[];
}) {
  const router = useRouter();
  const [loanProductId, setLoanProductId] = useState(loanProducts[0]?.id ?? "");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState("12");
  const [requestType, setRequestType] = useState<"SAVINGS_WITHDRAWAL" | "SHARE_REDEMPTION">("SAVINGS_WITHDRAWAL");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestFilter, setRequestFilter] = useState<"ALL" | "PENDING" | "RESOLVED">("ALL");
  const [query, setQuery] = useState("");
  const [loanMessage, setLoanMessage] = useState<string | null>(null);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [approvingScheduleLoanId, setApprovingScheduleLoanId] = useState<string | null>(null);

  const selectedLoanProduct =
    loanProducts.find((product) => product.id === loanProductId) ?? loanProducts[0] ?? null;

  const visibleRequests = requests.filter((request) => {
    const statusPass =
      requestFilter === "ALL"
        ? true
        : requestFilter === "PENDING"
          ? request.status === "PENDING"
          : request.status !== "PENDING";
    const q = query.trim().toLowerCase();
    const queryPass =
      q.length === 0
        ? true
        : `${request.type} ${request.note ?? ""} ${request.status}`.toLowerCase().includes(q);
    return statusPass && queryPass;
  });

  const submitLoan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoanSubmitting(true);
    setLoanMessage(null);
    setLoanError(null);
    try {
      const response = await fetch("/api/member/loans/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanProductId,
          principalAmount: loanAmount,
          termMonths: loanTerm,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Loan application failed");
      }
      setLoanMessage("Loan application submitted successfully.");
      setLoanAmount("");
      setLoanTerm("12");
      router.refresh();
    } catch (submitError) {
      setLoanError(submitError instanceof Error ? submitError.message : "Unable to submit loan request");
    } finally {
      setLoanSubmitting(false);
    }
  };

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestSubmitting(true);
    setRequestMessage(null);
    setRequestError(null);
    try {
      const response = await fetch("/api/member/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: requestType,
          amount: requestAmount,
          note: requestNote || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Request submission failed");
      }
      setRequestMessage("Request submitted and pending review.");
      setRequestAmount("");
      setRequestNote("");
      router.refresh();
    } catch (submitError) {
      setRequestError(submitError instanceof Error ? submitError.message : "Unable to submit request");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const approveSchedule = async (loanId: string) => {
    setApprovingScheduleLoanId(loanId);
    setScheduleError(null);
    setScheduleMessage(null);
    try {
      const response = await fetch(`/api/member/loans/${loanId}/schedule-approve`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to approve schedule");
      }
      setScheduleMessage("Loan payment schedule approved. Loan can now proceed to disbursement.");
      router.refresh();
    } catch (approveError) {
      setScheduleError(approveError instanceof Error ? approveError.message : "Unable to approve schedule");
    } finally {
      setApprovingScheduleLoanId(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Loan Request</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a new loan application and track status updates.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitLoan}>
          <select
            value={loanProductId}
            onChange={(event) => {
              const nextProductId = event.target.value;
              setLoanProductId(nextProductId);
              const selected = loanProducts.find((product) => product.id === nextProductId);
              if (selected) {
                setLoanTerm(String(selected.minTermMonths));
              }
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {loanProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.repaymentFrequency})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={loanAmount}
            onChange={(event) => setLoanAmount(event.target.value)}
            placeholder="Amount"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            min={1}
            value={loanTerm}
            onChange={(event) => setLoanTerm(event.target.value)}
            placeholder="Term months"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
          {selectedLoanProduct ? (
            <p className="text-xs text-muted-foreground">
              Product limits: {formatMoney(selectedLoanProduct.minPrincipal)} - {formatMoney(selectedLoanProduct.maxPrincipal)} | Term {selectedLoanProduct.minTermMonths}-{selectedLoanProduct.maxTermMonths} months
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loanSubmitting}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            {loanSubmitting ? "Submitting..." : "Submit Loan Request"}
          </button>
          {loanMessage ? <p className="text-sm text-emerald-700">{loanMessage}</p> : null}
          {loanError ? <p className="text-sm text-red-700">{loanError}</p> : null}
        </form>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit withdrawal or share redemption requests for review.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitRequest}>
          <select
            value={requestType}
            onChange={(event) =>
              setRequestType(event.target.value as "SAVINGS_WITHDRAWAL" | "SHARE_REDEMPTION")
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="SAVINGS_WITHDRAWAL">Savings Withdrawal</option>
            <option value="SHARE_REDEMPTION">Share Redemption</option>
          </select>
          <input
            type="number"
            min={1}
            value={requestAmount}
            onChange={(event) => setRequestAmount(event.target.value)}
            placeholder="Amount"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            value={requestNote}
            onChange={(event) => setRequestNote(event.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={requestSubmitting}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            {requestSubmitting ? "Submitting..." : "Submit Request"}
          </button>
          {requestMessage ? <p className="text-sm text-emerald-700">{requestMessage}</p> : null}
          {requestError ? <p className="text-sm text-red-700">{requestError}</p> : null}
        </form>
      </section>

      <section className="rounded-lg border bg-card p-6 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Statements</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download your personal statement as CSV or PDF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/member/statement/export?format=csv" className="rounded-md border border-border px-3 py-1.5 text-xs">
              Download CSV
            </a>
            <a href="/api/member/statement/export?format=pdf" className="rounded-md border border-border px-3 py-1.5 text-xs">
              Download PDF
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 xl:col-span-2">
        <h2 className="text-lg font-semibold">Loan Schedules Awaiting Your Approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve repayment schedule before funds can be disbursed.
        </p>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {loansPendingScheduleApproval.map((loan) => (
            <article key={loan.id} className="rounded-md border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Loan {loan.id.slice(0, 8)}</p>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Approval Needed
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Principal: {formatMoney(loan.principalAmount)} | Interest: {formatMoney(loan.interestAmount)} | Term: {loan.termMonths} months
              </p>
              <div className="mt-2 space-y-1 rounded-md border border-border p-2">
                {loan.schedule.slice(0, 4).map((row) => (
                  <p key={row.installmentNumber} className="text-xs text-muted-foreground">
                    #{row.installmentNumber} | {formatDateTimeUtc(row.dueAt)} | {formatMoney(row.total)}
                  </p>
                ))}
                {loan.schedule.length > 4 ? (
                  <p className="text-xs text-muted-foreground">+ {loan.schedule.length - 4} more installments</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={approvingScheduleLoanId === loan.id}
                onClick={() => approveSchedule(loan.id)}
                className="mt-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                {approvingScheduleLoanId === loan.id ? "Approving..." : "Approve Schedule"}
              </button>
            </article>
          ))}
          {loansPendingScheduleApproval.length === 0 ? (
            <article className="rounded-md border border-dashed bg-background px-4 py-4 xl:col-span-2">
              <p className="text-sm font-medium">No loan schedules need approval right now.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approved loans will appear here for your confirmation before disbursement.
              </p>
            </article>
          ) : null}
        </div>
        {scheduleMessage ? <p className="mt-3 text-sm text-emerald-700">{scheduleMessage}</p> : null}
        {scheduleError ? <p className="mt-3 text-sm text-red-700">{scheduleError}</p> : null}
      </section>

      <section className="rounded-lg border bg-card p-6 xl:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">My Requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Track request status and outcomes.</p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search requests"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={requestFilter}
              onChange={(event) =>
                setRequestFilter(event.target.value as "ALL" | "PENDING" | "RESOLVED")
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All requests</option>
              <option value="PENDING">Pending only</option>
              <option value="RESOLVED">Resolved only</option>
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {visibleRequests.map((request) => (
            <article key={request.id} className="rounded-md border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{requestTypeLabel(request.type)}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusChipClass(request.status)}`}
                >
                  {request.status}
                </span>
              </div>
              <p className="mt-1 text-sm">Amount: {formatMoney(request.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{request.note ?? "No note"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeUtc(request.createdAt)}</p>
            </article>
          ))}
          {visibleRequests.length === 0 ? (
            <article className="rounded-md border border-dashed bg-background px-4 py-5 md:col-span-2">
              <p className="text-sm font-medium">No requests match this filter.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Submit a new request above or switch filters to view past activity.
              </p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
