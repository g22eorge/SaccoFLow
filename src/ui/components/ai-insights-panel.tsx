"use client";

import { useState } from "react";
import { formatMoney } from "@/src/lib/money";

type Insights = {
  executiveBrief: string;
  creditDecisionAssistant: Array<{
    loanId: string;
    memberName: string;
    score: number;
    confidence: number;
    recommendation: string;
    reasonCodes: string[];
  }>;
  earlyDelinquencyPrediction: Array<{
    loanId: string;
    memberName: string;
    risk: string;
    daysToDue: number | null;
    daysSinceLastRepayment: number;
  }>;
  collectionsNextBestAction: Array<{
    loanId?: string;
    memberName?: string;
    risk?: string;
    channel: string;
    timing: string;
    script: string;
    lastAction?: { actionType: string; createdAt: string } | null;
  }>;
  anomalyFraudDetection: {
    highValueAdjustments: Array<{ id: string; memberName: string; amount: string }>;
    rapidLoanApplications: Array<{ memberId: string; applications7d: number }>;
    possibleApprovalBypass: Array<{ loanId: string; principalAmount: string }>;
    flaggedExternalCapital: Array<{ id: string; source: string; baseAmount: string; amlFlag: boolean; isLargeInflow: boolean }>;
  };
  donorIntelligence: {
    repeatDonors: Array<{ source: string; count: number; total: string }>;
    monthlyTotals: Array<{ month: string; total: string }>;
    forecastNextMonth: string;
  };
  smartReconciliation: {
    sampledSavingsTransactions: number;
    missingLedgerEntries: number;
    missingLedgerAmount: string;
    proposal: string;
  };
  memberNudgingEngine: Array<{
    loanId: string;
    memberName: string;
    daysToDue: number;
    preferredChannel: string;
    timing: string;
    message: string;
  }>;
};

export function AiInsightsPanel({ insights }: { insights: Insights }) {
  const [simInput, setSimInput] = useState({
    greenMinScore: "",
    creditCapacityMultiplier: "",
    minRepaymentCount: "",
    utilizationWarningThreshold: "",
    utilizationHardStopThreshold: "",
  });
  const [simResult, setSimResult] = useState<null | {
    totalPendingLoans: number;
    projectedAutoEligibleLoans: number;
    projectedAutoEligiblePercent: number;
    averageProjectedScore: number;
  }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, number> = {};
      for (const [key, value] of Object.entries(simInput)) {
        if (value !== "") {
          payload[key] = Number(value);
        }
      }
      const response = await fetch("/api/ai/policy-simulator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? "Simulation failed");
      }
      setSimResult(result.data);
    } catch (simulationError) {
      setError(simulationError instanceof Error ? simulationError.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Executive Brief Generator</h2>
        <p className="mt-2 text-sm text-muted-foreground">{insights.executiveBrief}</p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Credit Decision Assistant</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.creditDecisionAssistant.slice(0, 9).map((item) => (
            <article key={item.loanId} className="rounded-md border bg-background px-4 py-3">
              <p className="text-sm font-semibold">{item.memberName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.recommendation}</p>
              <p className="mt-1 text-xs text-muted-foreground">Score {item.score} | Confidence {item.confidence}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.reasonCodes.join(", ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Early Delinquency Prediction & Next Best Action</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {insights.collectionsNextBestAction.slice(0, 10).map((item) => (
            <article key={item.loanId} className="rounded-md border bg-background px-4 py-3">
              <p className="text-sm font-semibold">{item.memberName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Risk {item.risk} | Channel {item.channel} | Timing {item.timing}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.script}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Anomaly & Fraud Detection</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">High Value Adjustments</p>
            <p className="mt-1 text-xl font-semibold">{insights.anomalyFraudDetection.highValueAdjustments.length}</p>
          </article>
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rapid Loan Applications</p>
            <p className="mt-1 text-xl font-semibold">{insights.anomalyFraudDetection.rapidLoanApplications.length}</p>
          </article>
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Approval Bypass Suspects</p>
            <p className="mt-1 text-xl font-semibold">{insights.anomalyFraudDetection.possibleApprovalBypass.length}</p>
          </article>
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged External Capital</p>
            <p className="mt-1 text-xl font-semibold">{insights.anomalyFraudDetection.flaggedExternalCapital.length}</p>
          </article>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Donor Intelligence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Forecast next month inflow: {formatMoney(insights.donorIntelligence.forecastNextMonth)}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-sm font-semibold">Repeat Donors</p>
            {insights.donorIntelligence.repeatDonors.slice(0, 6).map((row) => (
              <p key={row.source} className="mt-1 text-xs text-muted-foreground">{row.source}: {row.count} txns ({formatMoney(row.total)})</p>
            ))}
          </article>
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-sm font-semibold">Monthly Trend</p>
            {insights.donorIntelligence.monthlyTotals.map((row) => (
              <p key={row.month} className="mt-1 text-xs text-muted-foreground">{row.month}: {formatMoney(row.total)}</p>
            ))}
          </article>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Smart Reconciliation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Missing ledger entries: {insights.smartReconciliation.missingLedgerEntries} / {insights.smartReconciliation.sampledSavingsTransactions}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Missing amount: {formatMoney(insights.smartReconciliation.missingLedgerAmount)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Proposal: {insights.smartReconciliation.proposal}</p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Policy Simulator</h2>
        <form onSubmit={runSimulation} className="mt-3 grid gap-3 md:grid-cols-3">
          <input placeholder="Green min score" value={simInput.greenMinScore} onChange={(e) => setSimInput((prev) => ({ ...prev, greenMinScore: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Capacity multiplier" value={simInput.creditCapacityMultiplier} onChange={(e) => setSimInput((prev) => ({ ...prev, creditCapacityMultiplier: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Min repayment count" value={simInput.minRepaymentCount} onChange={(e) => setSimInput((prev) => ({ ...prev, minRepaymentCount: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Util warning threshold" value={simInput.utilizationWarningThreshold} onChange={(e) => setSimInput((prev) => ({ ...prev, utilizationWarningThreshold: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Util hard-stop threshold" value={simInput.utilizationHardStopThreshold} onChange={(e) => setSimInput((prev) => ({ ...prev, utilizationHardStopThreshold: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" disabled={busy} className="rounded-lg border border-border px-3 py-2 text-sm">
            {busy ? "Simulating..." : "Run Simulation"}
          </button>
        </form>
        {simResult ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <article className="rounded-md border bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Loans</p>
              <p className="mt-1 text-xl font-semibold">{simResult.totalPendingLoans}</p>
            </article>
            <article className="rounded-md border bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected Auto Eligible</p>
              <p className="mt-1 text-xl font-semibold">{simResult.projectedAutoEligibleLoans} ({simResult.projectedAutoEligiblePercent.toFixed(1)}%)</p>
            </article>
            <article className="rounded-md border bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Score</p>
              <p className="mt-1 text-xl font-semibold">{simResult.averageProjectedScore.toFixed(1)}</p>
            </article>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Member Nudging Engine</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.memberNudgingEngine.slice(0, 12).map((item) => (
            <article key={item.loanId} className="rounded-md border bg-background px-4 py-3">
              <p className="text-sm font-semibold">{item.memberName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Due in {item.daysToDue} days | {item.preferredChannel} | {item.timing}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
