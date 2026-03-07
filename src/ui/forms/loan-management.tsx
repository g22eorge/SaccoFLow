"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "@/src/lib/money";
import { formatMemberLabel } from "@/src/lib/member-label";

type MemberOption = {
  id: string;
  fullName: string;
  memberNumber: string;
  shareBalance: string;
};

type LoanProductOption = {
  id: string;
  name: string;
  minPrincipal: string;
  maxPrincipal: string;
  minTermMonths: number;
  maxTermMonths: number;
  annualRatePercent: string | null;
  monthlyRatePercent: string | null;
  repaymentFrequency: string;
  isActive: boolean;
  isDefault: boolean;
};

type LoanRow = {
  id: string;
  memberId: string;
  memberName: string;
  loanProductId: string | null;
  loanProductName: string;
  status: string;
  termMonths: number;
  dueAt: string | null;
  principalAmount: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingPenalty: string;
  scheduleApprovedByMember: boolean;
  scheduleAutoApproved: boolean;
  scheduleApprovalScore: number | null;
  scheduleApprovalRiskTier: string | null;
  scheduleApprovalReasons: string[];
  approvalRequiredCount: number;
  approvalCurrentCount: number;
  approvalCompleted: boolean;
  approvalSlaDueAt: string | null;
  approvalRoleGroups: string[];
};

const trustReasonLabel = (reason: string) => {
  if (reason === "SAVINGS_ACTIVITY_TRUST_PENDING") {
    return "Savings activity pending";
  }
  if (reason === "LENDING_ACTIVITY_TRUST_PENDING") {
    return "Lending history pending";
  }
  if (reason === "LIMITED_REPAYMENT_HISTORY") {
    return "Repayment history pending";
  }
  return reason.replaceAll("_", " ").toLowerCase();
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

const loanStatusChipClass = (status: string) => {
  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "APPROVED") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "ACTIVE" || status === "DISBURSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "DEFAULTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
};

const processFlowLabel = (loan: LoanRow) => {
  if (loan.status === "PENDING") {
    return `Approval in progress (${loan.approvalCurrentCount}/${loan.approvalRequiredCount})`;
  }
  if (loan.status === "APPROVED" && !loan.scheduleApprovedByMember) {
    return "Waiting member approval";
  }
  if (loan.status === "APPROVED" && loan.scheduleApprovedByMember) {
    return "Ready for disbursement";
  }
  if (loan.status === "DISBURSED") {
    return "Disbursed, awaiting repayment cycle";
  }
  if (loan.status === "ACTIVE") {
    return "Repayment in progress";
  }
  if (loan.status === "DEFAULTED") {
    return "Defaulted, move to collections";
  }
  if (loan.status === "CLEARED") {
    return "Cleared and closed";
  }
  return "In process";
};

export function LoanManagement({
  members,
  loans,
  loanProducts,
  role,
  initialQuery,
  initialStatusFilter,
  initialSortBy,
}: {
  members: MemberOption[];
  loans: LoanRow[];
  loanProducts: LoanProductOption[];
  role: string;
  initialQuery: string;
  initialStatusFilter:
    | "ALL"
    | "PENDING"
    | "APPROVED"
    | "DISBURSED"
    | "ACTIVE"
    | "DEFAULTED"
    | "CLEARED";
  initialSortBy: "name" | "outstanding" | "dueSoon";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeLoanProducts = loanProducts.filter((product) => product.isActive);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [termMonths, setTermMonths] = useState("1");
  const [loanProductId, setLoanProductId] = useState(activeLoanProducts[0]?.id ?? "");
  const [newProductName, setNewProductName] = useState("");
  const [newProductMinPrincipal, setNewProductMinPrincipal] = useState("100000");
  const [newProductMaxPrincipal, setNewProductMaxPrincipal] = useState("1000000");
  const [newProductMinTerm, setNewProductMinTerm] = useState("3");
  const [newProductMaxTerm, setNewProductMaxTerm] = useState("12");
  const [newProductFrequency, setNewProductFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("MONTHLY");
  const [newProductDefault, setNewProductDefault] = useState(false);
  const [newProductAnnualRate, setNewProductAnnualRate] = useState("");
  const [newProductMonthlyRate, setNewProductMonthlyRate] = useState("");
  const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({});
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "disburse" | "repay" | null>(null);
  const [loadingApply, setLoadingApply] = useState(false);
  const [loadingCreateProduct, setLoadingCreateProduct] = useState(false);
  const [loadingSeedStandardProducts, setLoadingSeedStandardProducts] = useState(false);
  const [loadingProductActionId, setLoadingProductActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "DISBURSED" | "ACTIVE" | "DEFAULTED" | "CLEARED"
  >(initialStatusFilter);
  const [sortBy, setSortBy] = useState<"name" | "outstanding" | "dueSoon">(initialSortBy);
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("TABLE");
  const [optimisticStatusByLoanId, setOptimisticStatusByLoanId] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const canApprove = ["SACCO_ADMIN", "LOAN_OFFICER", "TREASURER", "CHAIRPERSON"].includes(role);
  const canDisburse = ["SACCO_ADMIN", "TREASURER"].includes(role);
  const canRepay = ["SACCO_ADMIN", "TREASURER"].includes(role);

  const selectedLoanProduct =
    loanProducts.find((product) => product.id === loanProductId) ?? activeLoanProducts[0] ?? null;

  const currentQueryParam = searchParams.get("q") ?? "";
  const currentStatusParam = searchParams.get("status") ?? "ALL";
  const currentSortParam = searchParams.get("sort") ?? "dueSoon";

  useEffect(() => {
    setQuery((prev) => (prev === currentQueryParam ? prev : currentQueryParam));
  }, [currentQueryParam]);

  useEffect(() => {
    const status = currentStatusParam;
    if (
      status === "PENDING" ||
      status === "APPROVED" ||
      status === "DISBURSED" ||
      status === "ACTIVE" ||
      status === "DEFAULTED" ||
      status === "CLEARED"
    ) {
      setStatusFilter((prev) => (prev === status ? prev : status));
      return;
    }
    setStatusFilter((prev) => (prev === "ALL" ? prev : "ALL"));
  }, [currentStatusParam]);

  useEffect(() => {
    const sort = currentSortParam;
    if (sort === "name" || sort === "outstanding" || sort === "dueSoon") {
      setSortBy((prev) => (prev === sort ? prev : sort));
      return;
    }
    setSortBy((prev) => (prev === "dueSoon" ? prev : "dueSoon"));
  }, [currentSortParam]);

  const replaceFilters = useCallback(
    (next: { q?: string; status?: string; sort?: string; page?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const q = next.q ?? query;
      const status = next.status ?? statusFilter;
      const sort = next.sort ?? sortBy;

      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        params.delete("q");
      }

      if (status && status !== "ALL") {
        params.set("status", status);
      } else {
        params.delete("status");
      }

      if (sort && sort !== "dueSoon") {
        params.set("sort", sort);
      } else {
        params.delete("sort");
      }

      params.set("page", next.page ?? "1");
      const nextUrl = `${pathname}?${params.toString()}`;
      const currentUrl = `${pathname}?${searchParams.toString()}`;
      if (nextUrl === currentUrl) {
        return;
      }
      startTransition(() => {
        router.replace(nextUrl);
      });
    },
    [pathname, query, router, searchParams, sortBy, startTransition, statusFilter],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (currentQueryParam !== query) {
        replaceFilters({ q: query });
      }
    }, 320);
    return () => clearTimeout(handle);
  }, [currentQueryParam, query, replaceFilters]);

  const totalOutstanding = useCallback((loan: LoanRow) => {
    const toNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));
    return (
      toNumber(loan.outstandingPrincipal) +
      toNumber(loan.outstandingInterest) +
      toNumber(loan.outstandingPenalty)
    );
  }, []);

  const derivedLoans = useMemo(
    () =>
      loans.map((loan) => ({
        ...loan,
        status: optimisticStatusByLoanId[loan.id] ?? loan.status,
      })),
    [loans, optimisticStatusByLoanId],
  );

  const visibleLoans = useMemo(() => derivedLoans, [derivedLoans]);

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
          loanProductId,
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

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingCreateProduct(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/loan-products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newProductName,
          minPrincipal: Number(newProductMinPrincipal),
          maxPrincipal: Number(newProductMaxPrincipal),
          minTermMonths: Number(newProductMinTerm),
          maxTermMonths: Number(newProductMaxTerm),
          annualRatePercent: newProductAnnualRate ? Number(newProductAnnualRate) : undefined,
          monthlyRatePercent: newProductMonthlyRate ? Number(newProductMonthlyRate) : undefined,
          repaymentFrequency: newProductFrequency,
          isActive: true,
          isDefault: newProductDefault,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to create loan product");
      }

      setMessage(`Loan product ${payload.data?.name ?? newProductName} created.`);
      setNewProductName("");
      setNewProductDefault(false);
      setNewProductAnnualRate("");
      setNewProductMonthlyRate("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setLoadingCreateProduct(false);
    }
  };

  const updateProduct = async (productId: string, payload: Record<string, unknown>) => {
    setLoadingProductActionId(productId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/loan-products/${productId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to update loan product");
      }
      setMessage("Loan product updated.");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unexpected error");
    } finally {
      setLoadingProductActionId(null);
    }
  };

  const handleSeedStandardProducts = async () => {
    setLoadingSeedStandardProducts(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/loan-products/standard-catalog", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to seed standard products");
      }
      setMessage("Standard loan products are ready: Emergency, Development, and Business Expansion.");
      router.refresh();
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Unexpected error");
    } finally {
      setLoadingSeedStandardProducts(false);
    }
  };

  const callLoanAction = async (
    loanId: string,
    action: "approve" | "disburse" | "repay",
    body?: Record<string, unknown>,
  ) => {
    setBusyLoanId(loanId);
    setBusyAction(action);
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

      if (action === "approve") {
        const approvalMatrix = payload.data?.approvalMatrix as
          | {
              approvalsCount?: number;
              requiredApproverCount?: number;
              alreadyApproved?: boolean;
            }
          | undefined;

        if (approvalMatrix?.alreadyApproved) {
          setMessage("Your approval is already recorded. Waiting for the next required approver.");
        } else if (
          typeof approvalMatrix?.approvalsCount === "number" &&
          typeof approvalMatrix?.requiredApproverCount === "number" &&
          approvalMatrix.approvalsCount < approvalMatrix.requiredApproverCount
        ) {
          setMessage(
            `Approval recorded (${approvalMatrix.approvalsCount}/${approvalMatrix.requiredApproverCount}). Waiting next approver.`,
          );
        } else {
          setMessage("Loan approved. Ready for disbursement workflow.");
          setOptimisticStatusByLoanId((prev) => ({ ...prev, [loanId]: "APPROVED" }));
        }
      } else if (action === "disburse") {
        setOptimisticStatusByLoanId((prev) => ({ ...prev, [loanId]: "DISBURSED" }));
        setMessage("Disbursement posted. Refreshing balances...");
      } else {
        setMessage(`Loan ${action} action successful.`);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("saccoflow:badge-refresh"));
      }
      startTransition(() => {
        router.refresh();
      });
      return true;
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unexpected error",
      );
      return false;
    } finally {
      setBusyLoanId(null);
      setBusyAction(null);
    }
  };

  const handleRepay = async (loan: LoanRow) => {
    const rawAmount = repayAmounts[loan.id];
    const amount = Number(rawAmount);
    if (!rawAmount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid repayment amount greater than 0.");
      return;
    }

    const repaid = await callLoanAction(loan.id, "repay", {
      memberId: loan.memberId,
      amount,
    });

    if (repaid) {
      setRepayAmounts((prev) => ({ ...prev, [loan.id]: "" }));
    }
  };

  const exportLoans = (format: "excel" | "pdf") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    if (!params.get("page")) {
      params.set("page", "1");
    }
    window.location.href = `/api/loans/export?${params.toString()}`;
  };

  return (
    <section className="space-y-6">
      <form
        onSubmit={handleApply}
        className="space-y-4 rounded-lg border bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Apply Loan</h2>
        <p className="text-sm text-muted-foreground">
          Capture a loan request and push it through approval, disbursement, and
          repayment.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            value={loanProductId}
            onChange={(event) => {
              const nextProductId = event.target.value;
              setLoanProductId(nextProductId);
              const picked = loanProducts.find((product) => product.id === nextProductId);
              if (picked) {
                setTermMonths(String(picked.minTermMonths));
              }
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {activeLoanProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.repaymentFrequency})
              </option>
            ))}
          </select>
          <select
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {formatMemberLabel(member.memberNumber, member.fullName)} (Shares: {formatMoney(member.shareBalance)})
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
        {selectedLoanProduct ? (
          <p className="text-xs text-muted-foreground">
            Product limits: {formatMoney(selectedLoanProduct.minPrincipal)} - {formatMoney(selectedLoanProduct.maxPrincipal)} | Term {selectedLoanProduct.minTermMonths}-{selectedLoanProduct.maxTermMonths} months
          </p>
        ) : null}
        {activeLoanProducts.length === 0 ? (
          <p className="text-xs text-red-700">No active loan products. Activate one before applying loans.</p>
        ) : null}
        <button
          type="submit"
          disabled={loadingApply || activeLoanProducts.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {loadingApply ? "Submitting..." : "Apply Loan"}
        </button>
      </form>

      <form onSubmit={handleCreateProduct} className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Create Loan Product</h2>
        <p className="text-sm text-muted-foreground">
          Define additional loan products with separate limits and terms.
        </p>
        <button
          type="button"
          onClick={handleSeedStandardProducts}
          disabled={loadingSeedStandardProducts}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          {loadingSeedStandardProducts ? "Preparing..." : "Add Standard Product Pack"}
        </button>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            value={newProductName}
            onChange={(event) => setNewProductName(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Product name"
          />
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={newProductMinPrincipal}
            onChange={(event) => setNewProductMinPrincipal(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Min principal"
          />
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={newProductMaxPrincipal}
            onChange={(event) => setNewProductMaxPrincipal(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Max principal"
          />
          <input
            type="number"
            required
            min={1}
            step={1}
            value={newProductMinTerm}
            onChange={(event) => setNewProductMinTerm(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Min term"
          />
          <input
            type="number"
            required
            min={1}
            step={1}
            value={newProductMaxTerm}
            onChange={(event) => setNewProductMaxTerm(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Max term"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={newProductAnnualRate}
            onChange={(event) => setNewProductAnnualRate(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Annual rate override %"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={newProductMonthlyRate}
            onChange={(event) => setNewProductMonthlyRate(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Monthly rate override %"
          />
          <select
            value={newProductFrequency}
            onChange={(event) =>
              setNewProductFrequency(event.target.value as "WEEKLY" | "BIWEEKLY" | "MONTHLY")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Bi-weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={newProductDefault}
              onChange={(event) => setNewProductDefault(event.target.checked)}
            />
            Set as default product
          </label>
        </div>
        <button
          type="submit"
          disabled={loadingCreateProduct}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          {loadingCreateProduct ? "Creating..." : "Create Product"}
        </button>
      </form>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Loan Product Lifecycle</h2>
        <p className="text-sm text-muted-foreground">
          Manage default product, activation state, and product-level interest overrides.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {loanProducts.map((product) => (
            <article key={product.id} className="rounded-md border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{product.name}</p>
                <div className="flex items-center gap-1">
                  {product.isDefault ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      Default
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      product.isActive
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    {product.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMoney(product.minPrincipal)} - {formatMoney(product.maxPrincipal)} | {product.minTermMonths}-{product.maxTermMonths} months
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rate override: {product.annualRatePercent ? `${product.annualRatePercent}% annual` : "Default annual"} | {product.monthlyRatePercent ? `${product.monthlyRatePercent}% monthly` : "Default monthly"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {!product.isDefault ? (
                  <button
                    type="button"
                    disabled={loadingProductActionId === product.id}
                    onClick={() => updateProduct(product.id, { isDefault: true, isActive: true })}
                    className="rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    Set Default
                  </button>
                ) : null}
                {!product.isDefault ? (
                  <button
                    type="button"
                    disabled={loadingProductActionId === product.id}
                    onClick={() => updateProduct(product.id, { isActive: !product.isActive })}
                    className="rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    {product.isActive ? "Deactivate" : "Activate"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Loans</h2>
            <p className="text-sm text-muted-foreground">
              Filter and manage loan actions by status and risk.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search member"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                const nextStatus = event.target.value as
                  | "ALL"
                  | "PENDING"
                  | "APPROVED"
                  | "DISBURSED"
                  | "ACTIVE"
                  | "DEFAULTED"
                  | "CLEARED";
                setStatusFilter(nextStatus);
                replaceFilters({ status: nextStatus, page: "1" });
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="DISBURSED">Disbursed</option>
              <option value="ACTIVE">Active</option>
              <option value="DEFAULTED">Defaulted</option>
              <option value="CLEARED">Cleared</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => {
                const nextSort = event.target.value as "name" | "outstanding" | "dueSoon";
                setSortBy(nextSort);
                replaceFilters({ sort: nextSort, page: "1" });
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="dueSoon">Sort: Due soon</option>
              <option value="outstanding">Sort: Outstanding</option>
              <option value="name">Sort: Member name</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportLoans("excel")}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => exportLoans("pdf")}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Export PDF
            </button>
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
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Process flow documentation</p>
          <div className="mt-1 flex flex-wrap items-center gap-1 leading-5">
            <span>PENDING (matrix approvals)</span>
            <span aria-hidden="true">→</span>
            <span>APPROVED</span>
            <span aria-hidden="true">→</span>
            <span className="font-semibold">Waiting member approval</span>
            <span aria-hidden="true">→</span>
            <span>DISBURSED</span>
            <span aria-hidden="true">→</span>
            <span>ACTIVE</span>
            <span aria-hidden="true">→</span>
            <span>CLEARED</span>
          </div>
          <p className="mt-1 whitespace-normal leading-5">Risk exception path: DEFAULTED -&gt; collections.</p>
        </div>
        {viewMode === "CARDS" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleLoans.map((loan) => (
              <article
                key={loan.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                {(() => {
                  const trustPendingReasons = loan.scheduleApprovalReasons.filter((reason) =>
                    [
                      "SAVINGS_ACTIVITY_TRUST_PENDING",
                      "LENDING_ACTIVITY_TRUST_PENDING",
                      "LIMITED_REPAYMENT_HISTORY",
                    ].includes(reason),
                  );

                  return trustPendingReasons.length > 0 ? (
                    <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800">Trust Pending</p>
                      <p className="mt-1 text-xs text-amber-700">
                        {trustPendingReasons.map((reason) => trustReasonLabel(reason)).join(" | ")}
                      </p>
                    </div>
                  ) : null;
                })()}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{loan.memberName}</p>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${loanStatusChipClass(loan.status)}`}>
                      {loan.status}
                    </span>
                    {loan.scheduleAutoApproved ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        GREEN AUTO
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <p>
                    Product:{" "}
                    <span className="font-semibold text-foreground">{loan.loanProductName}</span>
                  </p>
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
                  {loan.status === "PENDING" ? (
                    <p>
                      Approval progress:{" "}
                      <span className="font-semibold text-foreground">
                        {loan.approvalCurrentCount}/{loan.approvalRequiredCount}
                      </span>
                      {loan.approvalRoleGroups.length > 0
                        ? ` | ${loan.approvalRoleGroups.join("+")}`
                        : ""}
                    </p>
                  ) : null}
                  {loan.status === "PENDING" && loan.approvalSlaDueAt ? (
                    <p>
                      Approval SLA:{" "}
                      <span className="font-semibold text-foreground">
                        {formatUtcDate(loan.approvalSlaDueAt)}
                      </span>
                    </p>
                  ) : null}
                  {loan.scheduleAutoApproved ? (
                    <p>
                      Auto score:{" "}
                      <span className="font-semibold text-foreground">
                        {loan.scheduleApprovalScore ?? "-"}
                        {loan.scheduleApprovalRiskTier ? ` (${loan.scheduleApprovalRiskTier})` : ""}
                      </span>
                    </p>
                  ) : null}
                  {loan.scheduleApprovalReasons.length > 0 ? (
                    <p className="line-clamp-2">
                      Reasons:{" "}
                      <span className="font-semibold text-foreground">
                        {loan.scheduleApprovalReasons.join(", ")}
                      </span>
                    </p>
                  ) : null}
                  <p>
                    Process flow:{" "}
                    <span className="font-semibold text-foreground">{processFlowLabel(loan)}</span>
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {loan.status === "PENDING" && canApprove ? (
                    <button
                      type="button"
                      disabled={busyLoanId === loan.id}
                      onClick={() => callLoanAction(loan.id, "approve")}
                      className="rounded-lg border border-border px-2 py-1"
                    >
                      {busyLoanId === loan.id && busyAction === "approve"
                        ? "Approving..."
                        : loan.approvalCurrentCount > 0
                          ? "Approve next step"
                          : "Start approval"}
                    </button>
                  ) : null}
                  {loan.status === "APPROVED" && canDisburse ? (
                    <>
                      <button
                        type="button"
                        disabled={busyLoanId === loan.id}
                        onClick={() => callLoanAction(loan.id, "disburse")}
                        className="rounded-lg border border-border px-2 py-1"
                      >
                        {busyLoanId === loan.id && busyAction === "disburse" ? "Disbursing..." : "Disburse"}
                      </button>
                      {!loan.scheduleApprovedByMember ? (
                        <p className="text-xs text-amber-700">Waiting member approval (authorized staff can override on disburse)</p>
                      ) : null}
                    </>
                  ) : null}
                  {["ACTIVE", "DISBURSED"].includes(loan.status) && canRepay ? (
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
                        {busyLoanId === loan.id && busyAction === "repay" ? "Posting..." : "Repay"}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="min-w-[25ch] px-3 py-2">Member</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Outstanding</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="min-w-[22ch] px-3 py-2">Process Flow</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLoans.map((loan) => {
                  const trustPendingReasons = loan.scheduleApprovalReasons.filter((reason) =>
                    [
                      "SAVINGS_ACTIVITY_TRUST_PENDING",
                      "LENDING_ACTIVITY_TRUST_PENDING",
                      "LIMITED_REPAYMENT_HISTORY",
                    ].includes(reason),
                  );

                  return (
                    <tr key={loan.id} className="border-t align-top hover:bg-muted/40">
                      <td className="min-w-[25ch] px-3 py-2 text-xs font-semibold">
                        {loan.memberName}
                        {trustPendingReasons.length > 0 ? (
                          <p className="mt-1 text-[11px] text-amber-700">
                            Trust pending: {trustPendingReasons.map((reason) => trustReasonLabel(reason)).join(" | ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${loanStatusChipClass(loan.status)}`}>
                            {loan.status}
                          </span>
                          {loan.scheduleAutoApproved ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              GREEN AUTO
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{loan.loanProductName}</td>
                      <td className="px-3 py-2 text-xs">{formatMoney(loan.principalAmount)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatMoney(totalOutstanding(loan))}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {loan.dueAt ? formatUtcDate(loan.dueAt) : "-"} ({loan.termMonths}m)
                      </td>
                      <td className="min-w-[22ch] px-3 py-2 text-xs text-muted-foreground">
                        <p>{processFlowLabel(loan)}</p>
                        {loan.status === "PENDING" ? (
                          <p className="mt-1 text-[11px]">
                            Approval {loan.approvalCurrentCount}/{loan.approvalRequiredCount}
                            {loan.approvalSlaDueAt ? ` | SLA ${formatUtcDate(loan.approvalSlaDueAt)}` : ""}
                          </p>
                        ) : null}
                        {loan.scheduleAutoApproved ? (
                          <p className="mt-1 text-[11px]">
                            Auto score {loan.scheduleApprovalScore ?? "-"}
                            {loan.scheduleApprovalRiskTier ? ` (${loan.scheduleApprovalRiskTier})` : ""}
                          </p>
                        ) : null}
                        {loan.scheduleApprovalReasons.length > 0 ? (
                          <p className="mt-1 line-clamp-2 text-[11px]">{loan.scheduleApprovalReasons.join(", ")}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex min-w-44 flex-wrap items-center gap-2">
                          {loan.status === "PENDING" && canApprove ? (
                            <button
                              type="button"
                              disabled={busyLoanId === loan.id}
                              onClick={() => callLoanAction(loan.id, "approve")}
                              className="rounded-lg border border-border px-2 py-1"
                            >
                              {busyLoanId === loan.id && busyAction === "approve"
                                ? "Approving..."
                                : loan.approvalCurrentCount > 0
                                  ? "Approve next"
                                  : "Start approval"}
                            </button>
                          ) : null}
                          {loan.status === "APPROVED" && canDisburse ? (
                            <button
                              type="button"
                              disabled={busyLoanId === loan.id}
                              onClick={() => callLoanAction(loan.id, "disburse")}
                              className="rounded-lg border border-border px-2 py-1"
                            >
                              {busyLoanId === loan.id && busyAction === "disburse" ? "Disbursing..." : "Disburse"}
                            </button>
                          ) : null}
                          {["ACTIVE", "DISBURSED"].includes(loan.status) && canRepay ? (
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
                                className="w-24 rounded border border-border bg-background px-2 py-1"
                                placeholder="Repay"
                              />
                              <button
                                type="button"
                                disabled={busyLoanId === loan.id}
                                onClick={() => handleRepay(loan)}
                                className="rounded-lg border border-border px-2 py-1"
                              >
                                {busyLoanId === loan.id && busyAction === "repay" ? "Posting..." : "Repay"}
                              </button>
                            </>
                          ) : null}
                          {loan.status === "APPROVED" && !loan.scheduleApprovedByMember ? (
                            <p className="text-[11px] text-amber-700">Waiting member approval (staff override available)</p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {visibleLoans.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No loans match this filter.</p>
        ) : null}
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
