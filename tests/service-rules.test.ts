import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Prisma } from "@prisma/client";

const state = {
  savingsAggregates: [] as Array<{
    type: string;
    _sum: { amount: Prisma.Decimal | null };
  }>,
  savingsCreates: 0,
  loanRecord: null as {
    id: string;
    saccoId: string;
    memberId: string;
    status: string;
    termMonths: number;
    dueAt: Date | null;
    appliedAt: Date;
    principalAmount: Prisma.Decimal;
    interestAmount: Prisma.Decimal;
    outstandingPrincipal: Prisma.Decimal;
    outstandingInterest: Prisma.Decimal;
    outstandingPenalty: Prisma.Decimal;
  } | null,
  transactionCalls: 0,
  loanUpdatePayload: null as Record<string, unknown> | null,
};

mock.module("@/src/server/services/ledger.service", () => ({
  LedgerService: {
    record: async () => ({ id: "ledger-1" }),
  },
}));

mock.module("@/src/server/services/audit.service", () => ({
  AuditService: {
    record: async () => ({ id: "audit-1" }),
  },
}));

mock.module("@/src/server/services/settings.service", () => ({
  SettingsService: {
    get: async () => ({
      savings: {
        minimumBalance: 0,
        dailyWithdrawalLimit: 1000000,
        monthlyWithdrawalLimit: 10000000,
      },
      loanProduct: {
        minPrincipal: 100,
        maxPrincipal: 10000000,
        minTermMonths: 1,
        maxTermMonths: 36,
      },
      interest: {
        annualRatePercent: 18,
        monthlyRatePercent: 1.5,
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
      repaymentAllocation: {
        primaryTarget: "PENALTY",
        secondaryTarget: "INTEREST",
        tertiaryTarget: "PRINCIPAL",
        overpaymentHandling: "HOLD_AS_CREDIT",
      },
    }),
  },
}));

mock.module("@/src/server/db/prisma", () => ({
  prisma: {
    savingsTransaction: {
      groupBy: async () => state.savingsAggregates,
      aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(0) } }),
      create: async () => {
        state.savingsCreates += 1;
        return { id: "txn-1" };
      },
    },
    loan: {
      findFirstOrThrow: async () => {
        if (!state.loanRecord) {
          throw new Error("Loan not found");
        }
        return state.loanRecord;
      },
      update: async (args: { data: Record<string, unknown> }) => {
        if (!state.loanRecord) {
          throw new Error("Loan not found");
        }
        state.loanUpdatePayload = args.data;
        return {
          ...state.loanRecord,
          ...args.data,
        };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      state.transactionCalls += 1;
      return callback({
        loanRepayment: { create: async () => ({ id: "repay-1" }) },
        loan: { update: async () => ({ id: "loan-1" }) },
        ledgerEntry: { create: async () => ({ id: "ledger-2" }) },
      });
    },
  },
}));

const { SavingsService } =
  await import("../src/server/services/savings.service.ts?service-rules-savings");
const { LoansService } =
  await import("../src/server/services/loans.service.ts?service-rules-loans");

describe("SavingsService business rules", () => {
  beforeEach(() => {
    state.savingsAggregates = [
      { type: "DEPOSIT", _sum: { amount: new Prisma.Decimal(100) } },
      { type: "WITHDRAWAL", _sum: { amount: new Prisma.Decimal(0) } },
    ];
    state.savingsCreates = 0;
    state.transactionCalls = 0;
    state.loanUpdatePayload = null;
    state.loanRecord = null;
  });

  it("rejects withdrawal larger than current balance", async () => {
    await expect(
      SavingsService.withdraw({
        saccoId: "sacco-1",
        memberId: "member-1",
        type: "WITHDRAWAL",
        amount: 150,
      }),
    ).rejects.toThrow("Withdrawal amount cannot exceed member savings balance");

    expect(state.savingsCreates).toBe(0);
  });
});

describe("LoansService business rules", () => {
  beforeEach(() => {
    state.loanRecord = {
      id: "loan-1",
      saccoId: "sacco-1",
      memberId: "member-1",
      status: "ACTIVE",
      termMonths: 6,
      dueAt: new Date("2026-12-31T00:00:00.000Z"),
      appliedAt: new Date("2026-01-01T00:00:00.000Z"),
      principalAmount: new Prisma.Decimal(1000),
      interestAmount: new Prisma.Decimal(0),
      outstandingPrincipal: new Prisma.Decimal(100),
      outstandingInterest: new Prisma.Decimal(0),
      outstandingPenalty: new Prisma.Decimal(0),
    };
    state.transactionCalls = 0;
    state.loanUpdatePayload = null;
  });

  it("rejects approving a loan that is not pending", async () => {
    await expect(LoansService.approve("loan-1", "sacco-1")).rejects.toThrow(
      "Only pending loans can be approved",
    );
  });

  it("rejects disbursing a loan that is not approved", async () => {
    state.loanRecord = {
      ...state.loanRecord!,
      status: "PENDING",
    };

    await expect(LoansService.disburse("loan-1", "sacco-1")).rejects.toThrow(
      "Only approved loans can be disbursed",
    );
  });

  it("marks approved loan as DISBURSED on disbursement", async () => {
    state.loanRecord = {
      ...state.loanRecord!,
      status: "APPROVED",
    };

    await LoansService.disburse("loan-1", "sacco-1");
    expect(state.loanUpdatePayload?.status).toBe("DISBURSED");
  });

  it("rejects repayment larger than outstanding principal", async () => {
    await expect(
      LoansService.repay("loan-1", {
        saccoId: "sacco-1",
        memberId: "member-1",
        amount: 200,
      }),
    ).rejects.toThrow("Repayment exceeds due amount");

    expect(state.transactionCalls).toBe(0);
  });
});

afterAll(() => {
  mock.restore();
});
