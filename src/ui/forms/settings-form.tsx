"use client";

import { useMemo, useState } from "react";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import {
  AppSettings,
  SettingsField,
  settingsSections,
} from "@/src/lib/settings";

type SettingsFormProps = {
  initialSettings: AppSettings;
  initialVersions: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
    actorRole: string | null;
    sourceVersionId: string | null;
    changedCount: number;
  }>;
  canEdit: boolean;
};

const sectionGroups = {
  lending: [
    "loanProduct",
    "interest",
    "repaymentAllocation",
    "delinquency",
    "overdueScope",
    "earlyRepayment",
    "approvalWorkflow",
    "autoDecision",
  ],
  capital: ["savings", "incomeCharges"],
  governance: ["saccoProfile", "notifications", "experience"],
} as const;

type SectionGroupKey = keyof typeof sectionGroups;

const sectionGroupLabels: Record<SectionGroupKey, string> = {
  lending: "Lending",
  capital: "Capital",
  governance: "Governance",
};

const pairedIncomeToggleMap: Record<string, string> = {
  registrationFee: "enableRegistrationFee",
  lateSavingsPenalty: "enableLateSavingsPenalty",
  delayedLoanPenalty: "enableDelayedLoanPenalty",
  exitCharge: "enableExitCharge",
  loanProcessingFee: "enableLoanProcessingFee",
  withdrawalCharge: "enableWithdrawalCharge",
  statementFee: "enableStatementFee",
  accountMaintenanceFee: "enableAccountMaintenanceFee",
  loanInterestIncomeAmount: "enableLoanInterestIncome",
  investmentIncomeAmount: "enableInvestmentIncome",
};

const numberFieldHints: Record<string, string> = {
  annualRatePercent: "Typical: 12 - 36%",
  monthlyRatePercent: "Typical: 1 - 3%",
  liquidityReserveRatioPercent: "Recommended: 15 - 30%",
  deployableShareCapitalRatioPercent: "Recommended: 20 - 60%",
  penaltyCapPercent: "Common cap: 10 - 30%",
};

const parseNumber = (value: string) => {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function SettingsForm({ initialSettings, initialVersions, canEdit }: SettingsFormProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const versions = initialVersions;
  const [activeGroup, setActiveGroup] = useState<SectionGroupKey>("lending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rollbackBusyId, setRollbackBusyId] = useState<string | null>(null);

  const applyAutoDecisionPreset = (
    preset: "conservative" | "balanced" | "aggressive",
  ) => {
    setSettings((previous) => {
      const next = structuredClone(previous) as AppSettings;
      const base = next.autoDecision;

      if (preset === "conservative") {
        next.autoDecision = {
          ...base,
          enableGreenAutoScheduleApproval: true,
          enableDelinquencyEarlyWarnings: true,
          greenMinScore: 85,
          savingsSecurityPercent: 60,
          sharesSecurityPercent: 70,
          creditCapacityMultiplier: 2,
          creditCapacityBaseBuffer: 100000,
          minSavingsDepositCount: 2,
          minLoanLifecycleCount: 1,
          minRepaymentCount: 6,
          requireAnyClearedLoan: true,
          maxAllowedOverdueOpenLoans: 0,
          defaultPenaltyPoints: 35,
          overduePenaltyPoints: 15,
          thinHistoryPenaltyPoints: 15,
          noClearedPenaltyPoints: 12,
          utilizationWarningThreshold: 0.7,
          utilizationHardStopThreshold: 0.95,
          utilizationWarningPenaltyPoints: 12,
          utilizationHardStopPenaltyPoints: 30,
          earlyWarningWatchDays: 45,
          earlyWarningEscalationDays: 21,
          earlyWarningNoRepaymentDays: 21,
          earlyWarningHighOutstandingRatio: 0.75,
          earlyWarningMaxCases: 12,
        };
      } else if (preset === "aggressive") {
        next.autoDecision = {
          ...base,
          enableGreenAutoScheduleApproval: true,
          enableDelinquencyEarlyWarnings: true,
          greenMinScore: 70,
          savingsSecurityPercent: 80,
          sharesSecurityPercent: 90,
          creditCapacityMultiplier: 3,
          creditCapacityBaseBuffer: 250000,
          minSavingsDepositCount: 1,
          minLoanLifecycleCount: 1,
          minRepaymentCount: 3,
          requireAnyClearedLoan: false,
          maxAllowedOverdueOpenLoans: 1,
          defaultPenaltyPoints: 25,
          overduePenaltyPoints: 10,
          thinHistoryPenaltyPoints: 8,
          noClearedPenaltyPoints: 8,
          utilizationWarningThreshold: 0.85,
          utilizationHardStopThreshold: 1.1,
          utilizationWarningPenaltyPoints: 8,
          utilizationHardStopPenaltyPoints: 20,
          earlyWarningWatchDays: 21,
          earlyWarningEscalationDays: 10,
          earlyWarningNoRepaymentDays: 35,
          earlyWarningHighOutstandingRatio: 0.85,
          earlyWarningMaxCases: 6,
        };
      } else {
        next.autoDecision = {
          ...base,
          enableGreenAutoScheduleApproval: true,
          enableDelinquencyEarlyWarnings: true,
          greenMinScore: 78,
          savingsSecurityPercent: 70,
          sharesSecurityPercent: 80,
          creditCapacityMultiplier: 2.5,
          creditCapacityBaseBuffer: 150000,
          minSavingsDepositCount: 1,
          minLoanLifecycleCount: 1,
          minRepaymentCount: 4,
          requireAnyClearedLoan: true,
          maxAllowedOverdueOpenLoans: 0,
          defaultPenaltyPoints: 30,
          overduePenaltyPoints: 12,
          thinHistoryPenaltyPoints: 12,
          noClearedPenaltyPoints: 10,
          utilizationWarningThreshold: 0.75,
          utilizationHardStopThreshold: 1,
          utilizationWarningPenaltyPoints: 10,
          utilizationHardStopPenaltyPoints: 25,
          earlyWarningWatchDays: 30,
          earlyWarningEscalationDays: 14,
          earlyWarningNoRepaymentDays: 30,
          earlyWarningHighOutstandingRatio: 0.8,
          earlyWarningMaxCases: 8,
        };
      }

      return next;
    });

    setMessage(
      `Applied ${preset} preset. Review and save settings to publish policy changes.`,
    );
    setError(null);
  };

  const streamlinedSections = useMemo(
    () =>
      settingsSections.filter((section) =>
        [
          "saccoProfile",
          "loanProduct",
          "interest",
          "repaymentAllocation",
          "delinquency",
          "overdueScope",
          "earlyRepayment",
          "savings",
          "incomeCharges",
          "approvalWorkflow",
          "autoDecision",
          "notifications",
          "experience",
        ].includes(section.key),
      ),
    [],
  );

  const visibleSections = useMemo(
    () =>
      streamlinedSections.filter((section) =>
        sectionGroups[activeGroup].includes(section.key as never),
      ),
    [activeGroup, streamlinedSections],
  );

  const changedFields = useMemo(() => {
    const changes: Array<{ key: string; before: unknown; after: unknown }> = [];
    for (const [sectionKey, sectionValue] of Object.entries(settings)) {
      const initialSection = initialSettings[sectionKey as keyof AppSettings] as Record<string, unknown>;
      const currentSection = sectionValue as Record<string, unknown>;
      for (const [fieldKey, afterValue] of Object.entries(currentSection)) {
        const beforeValue = initialSection[fieldKey];
        if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
          changes.push({
            key: `${sectionKey}.${fieldKey}`,
            before: beforeValue,
            after: afterValue,
          });
        }
      }
    }
    return changes;
  }, [initialSettings, settings]);

  const updateField = (
    sectionKey: keyof AppSettings,
    field: SettingsField,
    value: string | boolean,
  ) => {
    setSettings((previous) => {
      const next = structuredClone(previous) as AppSettings;
      const section = next[sectionKey] as Record<string, unknown>;

      if (field.type === "number") {
        section[field.key] = parseNumber(String(value));
      } else if (field.type === "boolean") {
        section[field.key] = Boolean(value);
      } else {
        section[field.key] = String(value);
      }

      return next;
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to save settings");
      }

      setMessage("Settings saved.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unexpected error",
      );
    } finally {
      setLoading(false);
    }
  };

  const rollbackToVersion = async (versionId: string) => {
    setRollbackBusyId(versionId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/versions/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to rollback settings version");
      }

      setMessage("Settings rolled back to selected version.");
      router.refresh();
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : "Unexpected rollback error");
    } finally {
      setRollbackBusyId(null);
    }
  };

  const renderInput = (
    sectionKey: keyof AppSettings,
    field: SettingsField,
    currentValue: unknown,
    sectionData: Record<string, unknown>,
  ) => {
    const pairedToggleKey =
      sectionKey === "incomeCharges" ? pairedIncomeToggleMap[field.key] : undefined;
    const pairedToggleEnabled = pairedToggleKey
      ? Boolean(sectionData[pairedToggleKey])
      : true;

    if (field.type === "boolean") {
      return (
        <label className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
          <span>{field.label}</span>
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            disabled={!canEdit}
            onChange={(event) =>
              updateField(sectionKey, field, event.currentTarget.checked)
            }
          />
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">{field.label}</span>
          <select
            value={String(currentValue)}
            disabled={!canEdit}
            onChange={(event) =>
              updateField(sectionKey, field, event.target.value)
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    const inputType = field.type === "number" ? "number" : field.type;
    return (
      <label className="space-y-1 text-sm">
        <span className="block text-muted-foreground">{field.label}</span>
        <input
          type={inputType}
          value={String(currentValue)}
          disabled={!canEdit || !pairedToggleEnabled}
          onChange={(event) =>
            updateField(sectionKey, field, event.target.value)
          }
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
        {numberFieldHints[field.key] ? (
          <p className="text-xs text-muted-foreground">{numberFieldHints[field.key]}</p>
        ) : null}
        {!pairedToggleEnabled ? (
          <p className="text-xs text-muted-foreground">Enable corresponding income stream to edit this value.</p>
        ) : null}
      </label>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Settings Modules</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(sectionGroups) as SectionGroupKey[]).map((groupKey) => (
            <button
              key={groupKey}
              type="button"
              onClick={() => setActiveGroup(groupKey)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                activeGroup === groupKey
                  ? "border-[#cc5500] bg-orange-50 text-[#cc5500]"
                  : "border-border bg-background"
              }`}
            >
              {sectionGroupLabels[groupKey]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Policy Version History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review recent policy snapshots and rollback when needed.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {versions.map((version) => (
            <article key={version.id} className="rounded-md border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{version.action}</p>
                <p className="text-xs text-muted-foreground">{formatDateTimeUtc(version.createdAt)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                By {version.actorName ?? version.actorEmail ?? "System"}
                {version.actorRole ? ` (${version.actorRole})` : ""}
              </p>
              {version.sourceVersionId ? (
                <p className="mt-1 text-xs text-muted-foreground">From version: {version.sourceVersionId.slice(0, 8)}</p>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => rollbackToVersion(version.id)}
                  disabled={rollbackBusyId === version.id}
                  className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  {rollbackBusyId === version.id ? "Rolling back..." : "Rollback to this version"}
                </button>
              ) : null}
            </article>
          ))}
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policy versions recorded yet.</p>
          ) : null}
        </div>
      </section>

      {visibleSections.map((section) => {
        const sectionData = settings[section.key] as Record<string, unknown>;
        const fieldsGridClass =
          section.key === "incomeCharges"
            ? "mt-4 grid gap-3 sm:grid-cols-2"
            : "mt-4 grid gap-3 md:grid-cols-2";
        const fieldMap = new Map(section.fields.map((field) => [field.key, field]));
        const incomeChargeRows: Array<[string, string | null]> = [
          ["shareUnitPrice", null],
          ["enableRegistrationFee", "registrationFee"],
          ["enableLateSavingsPenalty", "lateSavingsPenalty"],
          ["enableDelayedLoanPenalty", "delayedLoanPenalty"],
          ["enableExitCharge", "exitCharge"],
          ["enableLoanProcessingFee", "loanProcessingFee"],
          ["enableWithdrawalCharge", "withdrawalCharge"],
          ["enableStatementFee", "statementFee"],
          ["enableAccountMaintenanceFee", "accountMaintenanceFee"],
          ["enableLoanInterestIncome", "loanInterestIncomeAmount"],
          ["enableInvestmentIncome", "investmentIncomeAmount"],
        ];
        return (
          <section
            key={section.key}
            className="rounded-lg border bg-card p-6"
          >
            <h2 className="text-lg font-semibold">
              {section.title.replace(/^\d+\.\s*/, "")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            {section.key === "autoDecision" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => applyAutoDecisionPreset("conservative")}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  Conservative
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => applyAutoDecisionPreset("balanced")}
                  className="rounded-lg border border-[#cc5500] bg-orange-50 px-3 py-1.5 text-xs text-[#cc5500] disabled:opacity-60"
                >
                  Balanced
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => applyAutoDecisionPreset("aggressive")}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  Aggressive
                </button>
              </div>
            ) : null}
            {section.key === "incomeCharges" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {incomeChargeRows.map(([leftKey, rightKey]) => {
                  const leftField = fieldMap.get(leftKey);
                  const rightField = rightKey ? fieldMap.get(rightKey) : undefined;

                  if (!leftField) {
                    return null;
                  }

                  return (
                    <Fragment key={`${section.key}.${leftKey}.row`}>
                      <div
                        className="h-full rounded-lg border bg-background p-3"
                      >
                        {renderInput(section.key, leftField, sectionData[leftKey], sectionData)}
                      </div>
                      <div
                        className="h-full rounded-lg border bg-background p-3"
                      >
                        {rightField
                          ? renderInput(section.key, rightField, sectionData[rightKey!], sectionData)
                          : null}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <div className={fieldsGridClass}>
                {section.fields.map((field) => (
                  <div key={`${section.key}.${field.key}`}>
                    {renderInput(section.key, field, sectionData[field.key], sectionData)}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Change Preview</p>
        {changedFields.length > 0 ? (
          <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
            {changedFields.slice(0, 8).map((item) => (
              <li key={item.key}>
                {item.key}: <span className="text-foreground">{String(item.before)}</span>{" -> "}<span className="text-foreground">{String(item.after)}</span>
              </li>
            ))}
            {changedFields.length > 8 ? (
              <li>...and {changedFields.length - 8} more changes</li>
            ) : null}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">No unsaved changes yet.</p>
        )}
        <button
          type="submit"
          disabled={!canEdit || loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save All Settings"}
        </button>
        {!canEdit ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You have read-only access to settings.
          </p>
        ) : null}
        {message ? (
          <p className="mt-2 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}
