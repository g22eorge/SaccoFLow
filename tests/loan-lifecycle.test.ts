import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const state = {
  settings: {
    delinquency: {
      defaultAfterDaysPastDue: 90,
    },
  },
  loans: [] as Array<{
    id: string;
    saccoId: string;
    status: "DISBURSED" | "ACTIVE";
    dueAt: Date | null;
    appliedAt: Date;
  }>,
  updated: [] as Array<{ id: string; status: string }>,
  audited: [] as Array<{ entityId: string; status: string }>,
};

mock.module("@/src/server/services/settings.service", () => ({
  SettingsService: {
    get: async () => state.settings,
  },
}));

mock.module("@/src/server/services/audit.service", () => ({
  AuditService: {
    record: async (input: {
      entityId: string;
      after?: { status?: string };
    }) => {
      state.audited.push({
        entityId: input.entityId,
        status: input.after?.status ?? "",
      });
      return { id: "audit-1" };
    },
  },
}));

mock.module("@/src/server/db/prisma", () => ({
  prisma: {
    sacco: {
      findMany: async () => [{ id: "sacco-1" }],
    },
    loan: {
      findMany: async () => state.loans,
      update: async (args: { where: { id: string }; data: { status: string } }) => {
        state.updated.push({
          id: args.where.id,
          status: args.data.status,
        });
        return { id: args.where.id, status: args.data.status };
      },
    },
  },
}));

const { LoanLifecycleService } = await import(
  "../src/server/services/loan-lifecycle.service.ts?loan-lifecycle-test"
);

describe("LoanLifecycleService", () => {
  beforeEach(() => {
    state.updated = [];
    state.audited = [];
    state.settings = {
      delinquency: {
        defaultAfterDaysPastDue: 90,
      },
    };
    state.loans = [
      {
        id: "loan-default",
        saccoId: "sacco-1",
        status: "ACTIVE",
        dueAt: new Date("2025-01-01T00:00:00.000Z"),
        appliedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
      {
        id: "loan-active",
        saccoId: "sacco-1",
        status: "DISBURSED",
        dueAt: new Date("2026-12-01T00:00:00.000Z"),
        appliedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
  });

  it("moves overdue loans to DEFAULTED and disbursed loans to ACTIVE", async () => {
    const result = await LoanLifecycleService.reconcileSacco(
      "sacco-1",
      new Date("2026-03-03T00:00:00.000Z"),
    );

    expect(result.scanned).toBe(2);
    expect(result.movedToDefaulted).toBe(1);
    expect(result.movedToActive).toBe(1);
    expect(state.updated).toEqual([
      { id: "loan-default", status: "DEFAULTED" },
      { id: "loan-active", status: "ACTIVE" },
    ]);
    expect(state.audited).toEqual([
      { entityId: "loan-default", status: "DEFAULTED" },
      { entityId: "loan-active", status: "ACTIVE" },
    ]);
  });
});

afterAll(() => {
  mock.restore();
});
