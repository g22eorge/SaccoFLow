import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

class MockUnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = status;
  }
}

const state = {
  saccoId: "sacco-1",
  roleCalls: [] as string[][],
  writeRoleCalls: [] as string[][],
  roleError: null as Error | null,
  writeRoleError: null as Error | null,
  usersCreatePayload: null as Record<string, unknown> | null,
  membersCreatePayload: null as Record<string, unknown> | null,
  membersListArgs: null as Record<string, unknown> | null,
  membersRemoveArgs: null as { id: string; saccoId: string } | null,
  savingsListArgs: null as Record<string, unknown> | null,
  loansApplyPayload: null as Record<string, unknown> | null,
  loansApproveArgs: null as { id: string; saccoId: string } | null,
  loansDisburseArgs: null as { id: string; saccoId: string } | null,
  loansRepayArgs: null as {
    id: string;
    payload: Record<string, unknown>;
  } | null,
  reportSummaryArgs: null as { period: string; saccoId: string } | null,
  reportAuditArgs: null as Record<string, unknown> | null,
  reportStatementArgs: null as Record<string, unknown> | null,
  reportStatementCsvArgs: null as Record<string, unknown> | null,
  settingsGetSaccoId: null as string | null,
  settingsUpdateArgs: null as Record<string, unknown> | null,
  lifecycleSaccoArgs: null as Record<string, unknown> | null,
  lifecycleAllAsOf: null as string | null,
};

mock.module("@/src/server/auth/rbac", () => ({
  UnauthorizedError: MockUnauthorizedError,
  requireRoles: async (roles: string[]) => {
    state.roleCalls.push([...roles]);
    if (state.roleError) {
      throw state.roleError;
    }
    return { role: "SACCO_ADMIN" };
  },
  requireWriteRoles: async (roles: string[]) => {
    state.writeRoleCalls.push([...roles]);
    if (state.writeRoleError) {
      throw state.writeRoleError;
    }
    return { role: "SACCO_ADMIN" };
  },
  requireSaccoContext: async () => ({
    id: "app-1",
    role: "SACCO_ADMIN",
    saccoId: state.saccoId,
  }),
}));

mock.module("@/src/server/services/users.service", () => ({
  UsersService: {
    list: async () => [{ id: "user-1", email: "user1@example.com" }],
    create: async (payload: Record<string, unknown>) => {
      state.usersCreatePayload = payload;
      return {
        id: "user-2",
        email: payload.email,
        generatedPassword: "TempPass#123",
      };
    },
  },
}));

mock.module("@/src/server/services/members.service", () => ({
  MembersService: {
    list: async (args: Record<string, unknown>) => {
      state.membersListArgs = args;
      return [{ id: "member-1", fullName: "Jane Doe" }];
    },
    create: async (payload: Record<string, unknown>) => {
      state.membersCreatePayload = payload;
      return { id: "member-2", fullName: payload.fullName };
    },
    remove: async (id: string, saccoId: string) => {
      state.membersRemoveArgs = { id, saccoId };
      return { id };
    },
  },
}));

mock.module("@/src/server/services/savings.service", () => ({
  SavingsService: {
    list: async (args: Record<string, unknown>) => {
      state.savingsListArgs = args;
      return [{ id: "txn-1", memberId: "member-1", type: "DEPOSIT" }];
    },
  },
}));

mock.module("@/src/server/services/loans.service", () => ({
  LoansService: {
    apply: async (payload: Record<string, unknown>) => {
      state.loansApplyPayload = payload;
      return { id: "loan-1", status: "PENDING" };
    },
    list: async () => [],
    approve: async (id: string, saccoId: string) => {
      state.loansApproveArgs = { id, saccoId };
      return { id, status: "APPROVED" };
    },
    disburse: async (id: string, saccoId: string) => {
      state.loansDisburseArgs = { id, saccoId };
      return { id, status: "ACTIVE" };
    },
    repay: async (id: string, payload: Record<string, unknown>) => {
      state.loansRepayArgs = { id, payload };
      return { id: "repay-1", loanId: id };
    },
  },
}));

mock.module("@/src/server/services/reports.service", () => ({
  ReportsService: {
    summary: async (period: string, saccoId: string) => {
      state.reportSummaryArgs = { period, saccoId };
      return { period, memberCount: 10 };
    },
    auditTrail: async (args: Record<string, unknown>) => {
      state.reportAuditArgs = args;
      return [{ id: "audit-1" }];
    },
    memberStatement: async (args: Record<string, unknown>) => {
      state.reportStatementArgs = args;
      return { member: { id: "member-1" }, events: [] };
    },
    memberStatementCsv: async (args: Record<string, unknown>) => {
      state.reportStatementCsvArgs = args;
      return "date,type,amount,note\n";
    },
  },
}));

mock.module("@/src/server/services/settings.service", () => ({
  SettingsService: {
    get: async (saccoId: string) => {
      state.settingsGetSaccoId = saccoId;
      return { saccoProfile: { organizationName: "Demo" } };
    },
    update: async (
      saccoId: string,
      payload: Record<string, unknown>,
      actorId?: string,
    ) => {
      state.settingsUpdateArgs = { saccoId, payload, actorId };
      return payload;
    },
  },
}));

mock.module("@/src/server/services/loan-lifecycle.service", () => ({
  LoanLifecycleService: {
    reconcileSacco: async (saccoId: string, asOf: Date) => {
      state.lifecycleSaccoArgs = {
        saccoId,
        asOf: asOf.toISOString(),
      };
      return { saccoId, scanned: 10, movedToDefaulted: 1, movedToActive: 2 };
    },
    reconcileAll: async (asOf: Date) => {
      state.lifecycleAllAsOf = asOf.toISOString();
      return { scannedSaccos: 2, scannedLoans: 15 };
    },
  },
}));

let usersRoute: typeof import("../app/api/users/route");
let membersRoute: typeof import("../app/api/members/route");
let memberByIdRoute: typeof import("../app/api/members/[id]/route");
let savingsRoute: typeof import("../app/api/savings/route");
let loansApplyRoute: typeof import("../app/api/loans/apply/route");
let loansApproveRoute: typeof import("../app/api/loans/[id]/approve/route");
let loansDisburseRoute: typeof import("../app/api/loans/[id]/disburse/route");
let loansRepayRoute: typeof import("../app/api/loans/[id]/repay/route");
let reportsRoute: typeof import("../app/api/reports/route");
let reportsAuditRoute: typeof import("../app/api/reports/audit/route");
let reportsStatementRoute: typeof import("../app/api/reports/member-statement/route");
let reportsStatementExportRoute: typeof import("../app/api/reports/member-statement/export/route");
let settingsRoute: typeof import("../app/api/settings/route");
let lifecycleRoute: typeof import("../app/api/system/loans/reconcile/route");

beforeAll(async () => {
  usersRoute = await import("../app/api/users/route");
  membersRoute = await import("../app/api/members/route");
  memberByIdRoute = await import("../app/api/members/[id]/route");
  savingsRoute = await import("../app/api/savings/route");
  loansApplyRoute = await import("../app/api/loans/apply/route");
  loansApproveRoute = await import("../app/api/loans/[id]/approve/route");
  loansDisburseRoute = await import("../app/api/loans/[id]/disburse/route");
  loansRepayRoute = await import("../app/api/loans/[id]/repay/route");
  reportsRoute = await import("../app/api/reports/route");
  reportsAuditRoute = await import("../app/api/reports/audit/route");
  reportsStatementRoute =
    await import("../app/api/reports/member-statement/route");
  reportsStatementExportRoute =
    await import("../app/api/reports/member-statement/export/route");
  settingsRoute = await import("../app/api/settings/route");
  lifecycleRoute = await import("../app/api/system/loans/reconcile/route");
});

beforeEach(() => {
  state.roleCalls = [];
  state.writeRoleCalls = [];
  state.roleError = null;
  state.writeRoleError = null;
  state.usersCreatePayload = null;
  state.membersCreatePayload = null;
  state.membersListArgs = null;
  state.membersRemoveArgs = null;
  state.savingsListArgs = null;
  state.loansApplyPayload = null;
  state.loansApproveArgs = null;
  state.loansDisburseArgs = null;
  state.loansRepayArgs = null;
  state.reportSummaryArgs = null;
  state.reportAuditArgs = null;
  state.reportStatementArgs = null;
  state.reportStatementCsvArgs = null;
  state.settingsGetSaccoId = null;
  state.settingsUpdateArgs = null;
  state.lifecycleSaccoArgs = null;
  state.lifecycleAllAsOf = null;
});

afterAll(() => {
  mock.restore();
});

describe("Users API", () => {
  it("GET /api/users returns standardized success response", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/users?page=2"),
    } as unknown as Request;

    const response = await usersRoute.GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(state.roleCalls[0]).toEqual(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"]);
  });

  it("POST /api/users injects saccoId and creates assignable role", async () => {
    const request = {
      json: async () => ({
        email: "admin2@example.com",
        role: "MEMBER",
      }),
    } as unknown as Request;

    const response = await usersRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(state.usersCreatePayload).toEqual({
      email: "admin2@example.com",
      role: "MEMBER",
      saccoId: "sacco-1",
    });
    expect(state.roleCalls).toEqual([["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"]]);
  });

  it("POST /api/users returns 403 when role check fails", async () => {
    state.roleError = new MockUnauthorizedError("Insufficient role", 403);
    const request = {
      json: async () => ({ email: "blocked@example.com", role: "MEMBER" }),
    } as unknown as Request;

    const response = await usersRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_ERROR");
  });
});

describe("Members API", () => {
  it("GET /api/members passes query params into service", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/members?search=jane&page=3"),
    } as unknown as Request;

    const response = await membersRoute.GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.membersListArgs).toEqual({
      saccoId: "sacco-1",
      search: "jane",
      page: 3,
    });
  });

  it("POST /api/members injects saccoId", async () => {
    const request = {
      json: async () => ({ fullName: "New Member", memberNumber: "M-1001" }),
    } as unknown as Request;

    const response = await membersRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(state.membersCreatePayload).toEqual({
      fullName: "New Member",
      memberNumber: "M-1001",
      saccoId: "sacco-1",
    });
    expect(state.writeRoleCalls[0]).toEqual(["SACCO_ADMIN", "TREASURER"]);
  });

  it("DELETE /api/members/:id passes sacco context and member id", async () => {
    const request = {} as Request;
    const context = {
      params: Promise.resolve({ id: "member-77" }),
    } as { params: Promise<{ id: string }> };

    const response = await memberByIdRoute.DELETE(request as never, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.membersRemoveArgs).toEqual({
      id: "member-77",
      saccoId: "sacco-1",
    });
    expect(state.writeRoleCalls[0]).toEqual(["SACCO_ADMIN", "TREASURER"]);
  });
});

describe("Savings API", () => {
  it("GET /api/savings passes member filter and page into service", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/savings?memberId=member-1&page=2"),
    } as unknown as Request;

    const response = await savingsRoute.GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.savingsListArgs).toEqual({
      saccoId: "sacco-1",
      memberId: "member-1",
      page: 2,
    });
  });
});

describe("Loans API", () => {
  it("POST /api/loans/apply injects saccoId", async () => {
    const request = {
      json: async () => ({
        memberId: "member-1",
        principalAmount: 1200,
      }),
    } as unknown as Request;

    const response = await loansApplyRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(state.loansApplyPayload).toEqual({
      memberId: "member-1",
      principalAmount: 1200,
      saccoId: "sacco-1",
    });
    expect(state.writeRoleCalls[0]).toEqual(["SACCO_ADMIN", "LOAN_OFFICER"]);
  });

  it("POST /api/loans/:id/approve forwards sacco context", async () => {
    const request = {} as Request;
    const context = {
      params: Promise.resolve({ id: "loan-1" }),
    } as { params: Promise<{ id: string }> };

    const response = await loansApproveRoute.POST(request as never, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.loansApproveArgs).toEqual({
      id: "loan-1",
      saccoId: "sacco-1",
    });
    expect(state.writeRoleCalls[0]).toEqual(["SACCO_ADMIN", "LOAN_OFFICER"]);
  });

  it("POST /api/loans/:id/disburse forwards sacco context", async () => {
    const request = {} as Request;
    const context = {
      params: Promise.resolve({ id: "loan-1" }),
    } as { params: Promise<{ id: string }> };

    const response = await loansDisburseRoute.POST(request as never, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.loansDisburseArgs).toEqual({
      id: "loan-1",
      saccoId: "sacco-1",
    });
    expect(state.writeRoleCalls[0]).toEqual(["SACCO_ADMIN", "TREASURER"]);
  });

  it("POST /api/loans/:id/repay injects saccoId into payload", async () => {
    const request = {
      json: async () => ({ memberId: "member-1", amount: 250 }),
    } as unknown as Request;
    const context = {
      params: Promise.resolve({ id: "loan-1" }),
    } as { params: Promise<{ id: string }> };

    const response = await loansRepayRoute.POST(request as never, context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(state.loansRepayArgs).toEqual({
      id: "loan-1",
      payload: {
        memberId: "member-1",
        amount: 250,
        saccoId: "sacco-1",
      },
    });
    expect(state.writeRoleCalls[0]).toEqual(["SACCO_ADMIN", "TREASURER"]);
  });
});

describe("Reports API", () => {
  it("GET /api/reports forwards period and sacco context", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/reports?period=weekly"),
    } as unknown as Request;

    const response = await reportsRoute.GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.reportSummaryArgs).toEqual({
      period: "weekly",
      saccoId: "sacco-1",
    });
    expect(state.roleCalls[0]).toEqual([
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ]);
  });

  it("GET /api/reports/audit forwards filters", async () => {
    const request = {
      nextUrl: new URL(
        "http://localhost/api/reports/audit?page=2&entity=Loan&actorId=app-1",
      ),
    } as unknown as Request;

    const response = await reportsAuditRoute.GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.reportAuditArgs).toEqual({
      saccoId: "sacco-1",
      entity: "Loan",
      actorId: "app-1",
      page: 2,
    });
  });

  it("GET /api/reports/member-statement forwards member and date range", async () => {
    const request = {
      nextUrl: new URL(
        "http://localhost/api/reports/member-statement?memberId=member-1&from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.999Z",
      ),
    } as unknown as Request;

    const response = await reportsStatementRoute.GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.reportStatementArgs).toEqual({
      saccoId: "sacco-1",
      memberId: "member-1",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T23:59:59.999Z"),
    });
  });

  it("GET /api/reports/member-statement/export returns CSV", async () => {
    const request = {
      nextUrl: new URL(
        "http://localhost/api/reports/member-statement/export?memberId=member-1&from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.999Z",
      ),
    } as unknown as Request;

    const response = await reportsStatementExportRoute.GET(request as never);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("date,type,amount,note");
    expect(state.reportStatementCsvArgs).toEqual({
      saccoId: "sacco-1",
      memberId: "member-1",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T23:59:59.999Z"),
    });
  });
});

describe("Settings API", () => {
  it("GET /api/settings returns sacco settings", async () => {
    const response = await settingsRoute.GET({} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.settingsGetSaccoId).toBe("sacco-1");
    expect(state.roleCalls[0]).toEqual([
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ]);
  });

  it("PATCH /api/settings injects actor and sacco context", async () => {
    const request = {
      json: async () => ({
        interest: { annualRatePercent: 20 },
      }),
    } as unknown as Request;
    const response = await settingsRoute.PATCH(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.settingsUpdateArgs).toEqual({
      saccoId: "sacco-1",
      actorId: "app-1",
      payload: {
        interest: { annualRatePercent: 20 },
      },
    });
    expect(state.roleCalls[0]).toEqual(["SACCO_ADMIN", "SUPER_ADMIN"]);
  });
});

describe("Lifecycle API", () => {
  it("POST /api/system/loans/reconcile rejects invalid secret", async () => {
    process.env.CRON_SECRET = "secret-1";
    const request = {
      headers: { get: () => "wrong-secret" },
      json: async () => ({}),
    } as unknown as Request;
    const response = await lifecycleRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("POST /api/system/loans/reconcile calls reconcileAll", async () => {
    process.env.CRON_SECRET = "secret-1";
    const request = {
      headers: { get: () => "secret-1" },
      json: async () => ({ asOf: "2026-03-03T00:00:00.000Z" }),
    } as unknown as Request;
    const response = await lifecycleRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.lifecycleAllAsOf).toBe("2026-03-03T00:00:00.000Z");
  });

  it("POST /api/system/loans/reconcile calls reconcileSacco when saccoId is provided", async () => {
    process.env.CRON_SECRET = "secret-1";
    const request = {
      headers: { get: () => "secret-1" },
      json: async () => ({
        saccoId: "sacco-1",
        asOf: "2026-03-04T00:00:00.000Z",
      }),
    } as unknown as Request;
    const response = await lifecycleRoute.POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.lifecycleSaccoArgs).toEqual({
      saccoId: "sacco-1",
      asOf: "2026-03-04T00:00:00.000Z",
    });
  });
});
