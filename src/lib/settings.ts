import { z } from "zod";

export const settingsSchema = z.object({
  saccoProfile: z.object({
    organizationName: z.string().min(2),
    organizationCode: z.string().min(2),
    currency: z.string().min(3),
    timezone: z.string().min(2),
    locale: z.string().min(2),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
  }),
  loanProduct: z.object({
    defaultProductName: z.string().min(2),
    minPrincipal: z.number().nonnegative(),
    maxPrincipal: z.number().positive(),
    minTermMonths: z.number().int().positive(),
    maxTermMonths: z.number().int().positive(),
    repaymentFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
    requireGuarantor: z.boolean(),
    requireCollateral: z.boolean(),
  }),
  interest: z.object({
    interestModel: z.enum(["FLAT", "REDUCING_BALANCE"]),
    annualRatePercent: z.number().nonnegative(),
    monthlyRatePercent: z.number().nonnegative(),
    compounding: z.enum(["NONE", "MONTHLY"]),
    roundingRule: z.enum(["NEAREST", "UP", "DOWN"]),
    dayCountConvention: z.enum(["30_360", "ACTUAL_365"]),
    interestStartPoint: z.enum(["APPROVAL_DATE", "DISBURSEMENT_DATE"]),
  }),
  repaymentAllocation: z.object({
    primaryTarget: z.enum(["PENALTY", "INTEREST", "PRINCIPAL"]),
    secondaryTarget: z.enum(["PENALTY", "INTEREST", "PRINCIPAL"]),
    tertiaryTarget: z.enum(["PENALTY", "INTEREST", "PRINCIPAL"]),
    allowPartialPayments: z.boolean(),
    overpaymentHandling: z.enum(["HOLD_AS_CREDIT", "AUTO_APPLY_PRINCIPAL", "REFUND"]),
  }),
  delinquency: z.object({
    gracePeriodDays: z.number().int().nonnegative(),
    lateFeeType: z.enum(["FLAT", "PERCENT"]),
    lateFeeValue: z.number().nonnegative(),
    penaltyRatePercent: z.number().nonnegative(),
    penaltyFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    penaltyCapPercent: z.number().nonnegative(),
    defaultAfterDaysPastDue: z.number().int().positive(),
  }),
  overdueScope: z.object({
    continueInterestAfterMaturity: z.boolean(),
    overdueHandlingMode: z.enum(["EXTEND_TERM", "RESTRUCTURE", "COLLECTIONS"]),
    autoRestructureAfterDays: z.number().int().nonnegative(),
    collectionsAfterDaysPastDue: z.number().int().nonnegative(),
    legalEscalationAfterDays: z.number().int().nonnegative(),
  }),
  earlyRepayment: z.object({
    allowEarlyPayoff: z.boolean(),
    preClosureFeePercent: z.number().nonnegative(),
    interestRebateMethod: z.enum(["NONE", "PRO_RATA", "ACTUARIAL"]),
  }),
  savings: z.object({
    minimumBalance: z.number().nonnegative(),
    dailyWithdrawalLimit: z.number().nonnegative(),
    monthlyWithdrawalLimit: z.number().nonnegative(),
    withdrawalApprovalThreshold: z.number().nonnegative(),
    dormancyAfterDays: z.number().int().nonnegative(),
  }),
  approvalWorkflow: z.object({
    makerCheckerEnabled: z.boolean(),
    loanApprovalThreshold: z.number().nonnegative(),
    disbursementApprovalThreshold: z.number().nonnegative(),
    savingsWithdrawalThreshold: z.number().nonnegative(),
    requiredApproverCount: z.number().int().positive(),
  }),
  userRbac: z.object({
    sessionTimeoutMinutes: z.number().int().positive(),
    passwordMinLength: z.number().int().min(8),
    passwordRequireSymbols: z.boolean(),
    mfaRequired: z.boolean(),
    allowCustomRoles: z.boolean(),
  }),
  notifications: z.object({
    smsEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    whatsappEnabled: z.boolean(),
    repaymentReminderDaysBefore: z.number().int().nonnegative(),
    overdueReminderFrequencyDays: z.number().int().positive(),
    escalationEmail: z.string().email(),
  }),
  auditSecurity: z.object({
    auditRetentionDays: z.number().int().positive(),
    immutableAuditLogs: z.boolean(),
    trackIpDevice: z.boolean(),
    maxFailedLogins: z.number().int().positive(),
    confirmSensitiveActions: z.boolean(),
  }),
  accountingLedger: z.object({
    autoPostingEnabled: z.boolean(),
    lockPeriodAfterDays: z.number().int().nonnegative(),
    suspenseAccountCode: z.string().min(2),
    disbursementAccountCode: z.string().min(2),
    repaymentAccountCode: z.string().min(2),
  }),
  reportsExport: z.object({
    defaultReportPeriod: z.enum(["daily", "weekly", "monthly"]),
    allowCsvExport: z.boolean(),
    allowPdfExport: z.boolean(),
    scheduledReportHourUtc: z.number().int().min(0).max(23),
    scheduledReportEmail: z.string().email(),
  }),
  dataIntegrity: z.object({
    backupFrequencyHours: z.number().int().positive(),
    restoreDrillFrequencyDays: z.number().int().positive(),
    duplicateCheckEnabled: z.boolean(),
    strictValidationMode: z.boolean(),
    autoArchiveInactiveMembers: z.boolean(),
  }),
  compliance: z.object({
    kycRequired: z.boolean(),
    amlThresholdAmount: z.number().nonnegative(),
    consentRetentionDays: z.number().int().positive(),
    requireLoanDocuments: z.boolean(),
    minimumBorrowerAge: z.number().int().min(18),
  }),
  featureFlags: z.object({
    enableMemberPortal: z.boolean(),
    enableOfflineCapture: z.boolean(),
    enablePwa: z.boolean(),
    pilotMode: z.boolean(),
    enableAutomatedCollections: z.boolean(),
  }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: AppSettings = {
  saccoProfile: {
    organizationName: "My SACCO",
    organizationCode: "MS001",
    currency: "UGX",
    timezone: "Africa/Kampala",
    locale: "en-UG",
    fiscalYearStartMonth: 1,
  },
  loanProduct: {
    defaultProductName: "Standard Loan",
    minPrincipal: 100000,
    maxPrincipal: 10000000,
    minTermMonths: 1,
    maxTermMonths: 24,
    repaymentFrequency: "MONTHLY",
    requireGuarantor: true,
    requireCollateral: false,
  },
  interest: {
    interestModel: "REDUCING_BALANCE",
    annualRatePercent: 18,
    monthlyRatePercent: 1.5,
    compounding: "NONE",
    roundingRule: "NEAREST",
    dayCountConvention: "ACTUAL_365",
    interestStartPoint: "DISBURSEMENT_DATE",
  },
  repaymentAllocation: {
    primaryTarget: "PENALTY",
    secondaryTarget: "INTEREST",
    tertiaryTarget: "PRINCIPAL",
    allowPartialPayments: true,
    overpaymentHandling: "HOLD_AS_CREDIT",
  },
  delinquency: {
    gracePeriodDays: 3,
    lateFeeType: "PERCENT",
    lateFeeValue: 2,
    penaltyRatePercent: 1,
    penaltyFrequency: "MONTHLY",
    penaltyCapPercent: 25,
    defaultAfterDaysPastDue: 90,
  },
  overdueScope: {
    continueInterestAfterMaturity: true,
    overdueHandlingMode: "RESTRUCTURE",
    autoRestructureAfterDays: 30,
    collectionsAfterDaysPastDue: 60,
    legalEscalationAfterDays: 120,
  },
  earlyRepayment: {
    allowEarlyPayoff: true,
    preClosureFeePercent: 1,
    interestRebateMethod: "PRO_RATA",
  },
  savings: {
    minimumBalance: 10000,
    dailyWithdrawalLimit: 500000,
    monthlyWithdrawalLimit: 5000000,
    withdrawalApprovalThreshold: 300000,
    dormancyAfterDays: 180,
  },
  approvalWorkflow: {
    makerCheckerEnabled: true,
    loanApprovalThreshold: 1000000,
    disbursementApprovalThreshold: 1000000,
    savingsWithdrawalThreshold: 300000,
    requiredApproverCount: 2,
  },
  userRbac: {
    sessionTimeoutMinutes: 60,
    passwordMinLength: 10,
    passwordRequireSymbols: true,
    mfaRequired: false,
    allowCustomRoles: false,
  },
  notifications: {
    smsEnabled: true,
    emailEnabled: true,
    whatsappEnabled: false,
    repaymentReminderDaysBefore: 3,
    overdueReminderFrequencyDays: 2,
    escalationEmail: "admin@saccoflow.local",
  },
  auditSecurity: {
    auditRetentionDays: 2555,
    immutableAuditLogs: true,
    trackIpDevice: true,
    maxFailedLogins: 5,
    confirmSensitiveActions: true,
  },
  accountingLedger: {
    autoPostingEnabled: true,
    lockPeriodAfterDays: 5,
    suspenseAccountCode: "SUSP-001",
    disbursementAccountCode: "LOAN-DISB-001",
    repaymentAccountCode: "LOAN-REPAY-001",
  },
  reportsExport: {
    defaultReportPeriod: "monthly",
    allowCsvExport: true,
    allowPdfExport: false,
    scheduledReportHourUtc: 5,
    scheduledReportEmail: "reports@saccoflow.local",
  },
  dataIntegrity: {
    backupFrequencyHours: 24,
    restoreDrillFrequencyDays: 30,
    duplicateCheckEnabled: true,
    strictValidationMode: true,
    autoArchiveInactiveMembers: false,
  },
  compliance: {
    kycRequired: true,
    amlThresholdAmount: 10000000,
    consentRetentionDays: 2555,
    requireLoanDocuments: true,
    minimumBorrowerAge: 18,
  },
  featureFlags: {
    enableMemberPortal: false,
    enableOfflineCapture: false,
    enablePwa: false,
    pilotMode: true,
    enableAutomatedCollections: false,
  },
};

export type FieldType = "text" | "number" | "boolean" | "select" | "email";

export type SettingsField = {
  key: string;
  label: string;
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
};

export type SettingsSection = {
  key: keyof AppSettings;
  title: string;
  description: string;
  fields: SettingsField[];
};

export const settingsSections: SettingsSection[] = [
  {
    key: "saccoProfile",
    title: "1. SACCO Profile",
    description: "Organization identity and financial calendar settings.",
    fields: [
      { key: "organizationName", label: "Organization name", type: "text" },
      { key: "organizationCode", label: "Organization code", type: "text" },
      { key: "currency", label: "Currency", type: "text" },
      { key: "timezone", label: "Timezone", type: "text" },
      { key: "locale", label: "Locale", type: "text" },
      { key: "fiscalYearStartMonth", label: "Fiscal year start month", type: "number" },
    ],
  },
  {
    key: "loanProduct",
    title: "2. Loan Product",
    description: "Default loan constraints and eligibility controls.",
    fields: [
      { key: "defaultProductName", label: "Default product name", type: "text" },
      { key: "minPrincipal", label: "Minimum principal", type: "number" },
      { key: "maxPrincipal", label: "Maximum principal", type: "number" },
      { key: "minTermMonths", label: "Minimum term (months)", type: "number" },
      { key: "maxTermMonths", label: "Maximum term (months)", type: "number" },
      {
        key: "repaymentFrequency",
        label: "Repayment frequency",
        type: "select",
        options: [
          { value: "WEEKLY", label: "Weekly" },
          { value: "BIWEEKLY", label: "Bi-weekly" },
          { value: "MONTHLY", label: "Monthly" },
        ],
      },
      { key: "requireGuarantor", label: "Require guarantor", type: "boolean" },
      { key: "requireCollateral", label: "Require collateral", type: "boolean" },
    ],
  },
  {
    key: "interest",
    title: "3. Interest",
    description: "Interest rates, models, and accrual conventions.",
    fields: [
      {
        key: "interestModel",
        label: "Interest model",
        type: "select",
        options: [
          { value: "FLAT", label: "Flat" },
          { value: "REDUCING_BALANCE", label: "Reducing balance" },
        ],
      },
      { key: "annualRatePercent", label: "Annual rate (%)", type: "number" },
      { key: "monthlyRatePercent", label: "Monthly rate (%)", type: "number" },
      {
        key: "compounding",
        label: "Compounding",
        type: "select",
        options: [
          { value: "NONE", label: "None" },
          { value: "MONTHLY", label: "Monthly" },
        ],
      },
      {
        key: "roundingRule",
        label: "Rounding rule",
        type: "select",
        options: [
          { value: "NEAREST", label: "Nearest" },
          { value: "UP", label: "Round up" },
          { value: "DOWN", label: "Round down" },
        ],
      },
      {
        key: "dayCountConvention",
        label: "Day count",
        type: "select",
        options: [
          { value: "30_360", label: "30/360" },
          { value: "ACTUAL_365", label: "Actual/365" },
        ],
      },
      {
        key: "interestStartPoint",
        label: "Interest start",
        type: "select",
        options: [
          { value: "APPROVAL_DATE", label: "Approval date" },
          { value: "DISBURSEMENT_DATE", label: "Disbursement date" },
        ],
      },
    ],
  },
  {
    key: "repaymentAllocation",
    title: "4. Repayment Allocation",
    description: "Priority order for payment allocation and overpayments.",
    fields: [
      {
        key: "primaryTarget",
        label: "Primary target",
        type: "select",
        options: [
          { value: "PENALTY", label: "Penalty" },
          { value: "INTEREST", label: "Interest" },
          { value: "PRINCIPAL", label: "Principal" },
        ],
      },
      {
        key: "secondaryTarget",
        label: "Secondary target",
        type: "select",
        options: [
          { value: "PENALTY", label: "Penalty" },
          { value: "INTEREST", label: "Interest" },
          { value: "PRINCIPAL", label: "Principal" },
        ],
      },
      {
        key: "tertiaryTarget",
        label: "Tertiary target",
        type: "select",
        options: [
          { value: "PENALTY", label: "Penalty" },
          { value: "INTEREST", label: "Interest" },
          { value: "PRINCIPAL", label: "Principal" },
        ],
      },
      { key: "allowPartialPayments", label: "Allow partial payments", type: "boolean" },
      {
        key: "overpaymentHandling",
        label: "Overpayment handling",
        type: "select",
        options: [
          { value: "HOLD_AS_CREDIT", label: "Hold as credit" },
          { value: "AUTO_APPLY_PRINCIPAL", label: "Auto apply to principal" },
          { value: "REFUND", label: "Refund" },
        ],
      },
    ],
  },
  {
    key: "delinquency",
    title: "5. Delinquency",
    description: "Late-fee, penalty, and default parameters.",
    fields: [
      { key: "gracePeriodDays", label: "Grace period (days)", type: "number" },
      {
        key: "lateFeeType",
        label: "Late fee type",
        type: "select",
        options: [
          { value: "FLAT", label: "Flat" },
          { value: "PERCENT", label: "Percent" },
        ],
      },
      { key: "lateFeeValue", label: "Late fee value", type: "number" },
      { key: "penaltyRatePercent", label: "Penalty rate (%)", type: "number" },
      {
        key: "penaltyFrequency",
        label: "Penalty frequency",
        type: "select",
        options: [
          { value: "DAILY", label: "Daily" },
          { value: "WEEKLY", label: "Weekly" },
          { value: "MONTHLY", label: "Monthly" },
        ],
      },
      { key: "penaltyCapPercent", label: "Penalty cap (%)", type: "number" },
      { key: "defaultAfterDaysPastDue", label: "Default after days", type: "number" },
    ],
  },
  {
    key: "overdueScope",
    title: "6. Overdue Beyond Loan Scope",
    description: "What happens when a borrower pays after maturity.",
    fields: [
      {
        key: "continueInterestAfterMaturity",
        label: "Continue charging interest after maturity",
        type: "boolean",
      },
      {
        key: "overdueHandlingMode",
        label: "Overdue handling mode",
        type: "select",
        options: [
          { value: "EXTEND_TERM", label: "Extend term" },
          { value: "RESTRUCTURE", label: "Restructure" },
          { value: "COLLECTIONS", label: "Collections" },
        ],
      },
      { key: "autoRestructureAfterDays", label: "Auto restructure after days", type: "number" },
      { key: "collectionsAfterDaysPastDue", label: "Collections after days", type: "number" },
      { key: "legalEscalationAfterDays", label: "Legal escalation after days", type: "number" },
    ],
  },
  {
    key: "earlyRepayment",
    title: "7. Early Repayment",
    description: "Rules for pre-closure and interest rebate.",
    fields: [
      { key: "allowEarlyPayoff", label: "Allow early payoff", type: "boolean" },
      { key: "preClosureFeePercent", label: "Pre-closure fee (%)", type: "number" },
      {
        key: "interestRebateMethod",
        label: "Interest rebate",
        type: "select",
        options: [
          { value: "NONE", label: "None" },
          { value: "PRO_RATA", label: "Pro-rata" },
          { value: "ACTUARIAL", label: "Actuarial" },
        ],
      },
    ],
  },
  {
    key: "savings",
    title: "8. Savings",
    description: "Savings limits and dormancy controls.",
    fields: [
      { key: "minimumBalance", label: "Minimum balance", type: "number" },
      { key: "dailyWithdrawalLimit", label: "Daily withdrawal limit", type: "number" },
      { key: "monthlyWithdrawalLimit", label: "Monthly withdrawal limit", type: "number" },
      {
        key: "withdrawalApprovalThreshold",
        label: "Withdrawal approval threshold",
        type: "number",
      },
      { key: "dormancyAfterDays", label: "Dormancy after days", type: "number" },
    ],
  },
  {
    key: "approvalWorkflow",
    title: "9. Approval Workflow",
    description: "Maker-checker and threshold approvals.",
    fields: [
      { key: "makerCheckerEnabled", label: "Enable maker-checker", type: "boolean" },
      { key: "loanApprovalThreshold", label: "Loan approval threshold", type: "number" },
      {
        key: "disbursementApprovalThreshold",
        label: "Disbursement approval threshold",
        type: "number",
      },
      {
        key: "savingsWithdrawalThreshold",
        label: "Savings withdrawal threshold",
        type: "number",
      },
      { key: "requiredApproverCount", label: "Required approvers", type: "number" },
    ],
  },
  {
    key: "userRbac",
    title: "10. User & RBAC",
    description: "Session, password, and access policy settings.",
    fields: [
      { key: "sessionTimeoutMinutes", label: "Session timeout (minutes)", type: "number" },
      { key: "passwordMinLength", label: "Password minimum length", type: "number" },
      { key: "passwordRequireSymbols", label: "Require symbols in password", type: "boolean" },
      { key: "mfaRequired", label: "Require MFA", type: "boolean" },
      { key: "allowCustomRoles", label: "Allow custom roles", type: "boolean" },
    ],
  },
  {
    key: "notifications",
    title: "11. Notifications",
    description: "Outbound reminders and escalation contacts.",
    fields: [
      { key: "smsEnabled", label: "Enable SMS", type: "boolean" },
      { key: "emailEnabled", label: "Enable email", type: "boolean" },
      { key: "whatsappEnabled", label: "Enable WhatsApp", type: "boolean" },
      { key: "repaymentReminderDaysBefore", label: "Reminder days before due date", type: "number" },
      {
        key: "overdueReminderFrequencyDays",
        label: "Overdue reminder frequency (days)",
        type: "number",
      },
      { key: "escalationEmail", label: "Escalation email", type: "email" },
    ],
  },
  {
    key: "auditSecurity",
    title: "12. Audit & Security",
    description: "Security hardening and log retention policies.",
    fields: [
      { key: "auditRetentionDays", label: "Audit retention (days)", type: "number" },
      { key: "immutableAuditLogs", label: "Immutable audit logs", type: "boolean" },
      { key: "trackIpDevice", label: "Track IP/device", type: "boolean" },
      { key: "maxFailedLogins", label: "Max failed logins", type: "number" },
      { key: "confirmSensitiveActions", label: "Confirm sensitive actions", type: "boolean" },
    ],
  },
  {
    key: "accountingLedger",
    title: "13. Accounting & Ledger",
    description: "Posting mappings and lock-period controls.",
    fields: [
      { key: "autoPostingEnabled", label: "Auto-posting enabled", type: "boolean" },
      { key: "lockPeriodAfterDays", label: "Lock period after days", type: "number" },
      { key: "suspenseAccountCode", label: "Suspense account code", type: "text" },
      { key: "disbursementAccountCode", label: "Disbursement account code", type: "text" },
      { key: "repaymentAccountCode", label: "Repayment account code", type: "text" },
    ],
  },
  {
    key: "reportsExport",
    title: "14. Reports & Export",
    description: "Default report periods and export controls.",
    fields: [
      {
        key: "defaultReportPeriod",
        label: "Default report period",
        type: "select",
        options: [
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ],
      },
      { key: "allowCsvExport", label: "Allow CSV export", type: "boolean" },
      { key: "allowPdfExport", label: "Allow PDF export", type: "boolean" },
      { key: "scheduledReportHourUtc", label: "Scheduled report hour (UTC)", type: "number" },
      { key: "scheduledReportEmail", label: "Scheduled report email", type: "email" },
    ],
  },
  {
    key: "dataIntegrity",
    title: "15. Data Integrity",
    description: "Backup cadence and validation strictness.",
    fields: [
      { key: "backupFrequencyHours", label: "Backup frequency (hours)", type: "number" },
      {
        key: "restoreDrillFrequencyDays",
        label: "Restore drill frequency (days)",
        type: "number",
      },
      { key: "duplicateCheckEnabled", label: "Duplicate check enabled", type: "boolean" },
      { key: "strictValidationMode", label: "Strict validation mode", type: "boolean" },
      {
        key: "autoArchiveInactiveMembers",
        label: "Auto archive inactive members",
        type: "boolean",
      },
    ],
  },
  {
    key: "compliance",
    title: "16. Compliance",
    description: "KYC, AML, and borrower compliance controls.",
    fields: [
      { key: "kycRequired", label: "KYC required", type: "boolean" },
      { key: "amlThresholdAmount", label: "AML threshold amount", type: "number" },
      { key: "consentRetentionDays", label: "Consent retention (days)", type: "number" },
      { key: "requireLoanDocuments", label: "Require loan documents", type: "boolean" },
      { key: "minimumBorrowerAge", label: "Minimum borrower age", type: "number" },
    ],
  },
  {
    key: "featureFlags",
    title: "17. System Defaults & Feature Flags",
    description: "Module flags and rollout controls.",
    fields: [
      { key: "enableMemberPortal", label: "Enable member portal", type: "boolean" },
      { key: "enableOfflineCapture", label: "Enable offline capture", type: "boolean" },
      { key: "enablePwa", label: "Enable PWA", type: "boolean" },
      { key: "pilotMode", label: "Pilot mode", type: "boolean" },
      {
        key: "enableAutomatedCollections",
        label: "Enable automated collections",
        type: "boolean",
      },
    ],
  },
];
