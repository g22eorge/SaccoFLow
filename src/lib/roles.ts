export const SACCO_ROLE_OPTIONS = [
  "SACCO_ADMIN",
  "CHAIRPERSON",
  "BOARD_MEMBER",
  "TREASURER",
  "LOAN_OFFICER",
  "AUDITOR",
  "MEMBER",
] as const;

export type SaccoRole = (typeof SACCO_ROLE_OPTIONS)[number];

export const ASSIGNABLE_ROLES_BY_ACTOR = {
  PLATFORM_SUPER_ADMIN: [
    "SUPER_ADMIN",
    "SACCO_ADMIN",
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "LOAN_OFFICER",
    "AUDITOR",
    "MEMBER",
  ],
  SUPER_ADMIN: [
    "SACCO_ADMIN",
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "LOAN_OFFICER",
    "AUDITOR",
    "MEMBER",
  ],
  SACCO_ADMIN: [
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "LOAN_OFFICER",
    "AUDITOR",
    "MEMBER",
  ],
  CHAIRPERSON: ["BOARD_MEMBER", "TREASURER", "LOAN_OFFICER", "AUDITOR", "MEMBER"],
  BOARD_MEMBER: [],
  TREASURER: ["MEMBER"],
  LOAN_OFFICER: ["MEMBER"],
  AUDITOR: ["MEMBER"],
  MEMBER: [],
} as const;

export const ROLE_LEVELS: Record<SaccoRole, number> = {
  SACCO_ADMIN: 1,
  CHAIRPERSON: 2,
  BOARD_MEMBER: 3,
  TREASURER: 3,
  LOAN_OFFICER: 3,
  AUDITOR: 3,
  MEMBER: 4,
};

export const ROLE_DESCRIPTIONS: Record<SaccoRole, string> = {
  SACCO_ADMIN: "Operational executive for SACCO-wide administration.",
  CHAIRPERSON: "Board lead for governance, approvals, and policy direction.",
  BOARD_MEMBER: "Board oversight and voting without day-to-day execution.",
  TREASURER: "Finance operations lead for liquidity and transactions.",
  LOAN_OFFICER: "Credit operations lead for underwriting and collections.",
  AUDITOR: "Independent assurance, compliance, and audit oversight.",
  MEMBER: "Self-service account for personal SACCO activity.",
};
