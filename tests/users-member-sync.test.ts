import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const state = {
  appUserRole: "MEMBER",
  existingMember: null as { id: string } | null,
  generatedMemberNumber: "M-0001",
  memberCreatePayload: null as Record<string, unknown> | null,
  memberUsers: [] as Array<{
    id: string;
    saccoId: string;
    email: string;
    fullName: string | null;
  }>,
};

mock.module("@/src/server/db/prisma", () => ({
  prisma: {
    appUser: {
      upsert: async () => ({
        id: "app-user-1",
        email: "member1@example.com",
        fullName: "Member One",
        role: state.appUserRole,
        isActive: true,
        createdAt: new Date(),
      }),
      findMany: async () => state.memberUsers,
    },
    member: {
      findFirst: async () => state.existingMember,
    },
  },
}));

mock.module("@/src/server/auth/auth", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: {
        findUserByEmail: async () => ({
          user: { id: "auth-user-1" },
          accounts: [{ providerId: "credential" }],
        }),
        findAccounts: async () => [{ providerId: "credential" }],
      },
      password: {
        hash: async () => "hash",
      },
    }),
  },
}));

mock.module("@/src/server/services/audit.service", () => ({
  AuditService: {
    record: async () => ({ id: "audit-1" }),
  },
}));

mock.module("@/src/server/services/members.service", () => ({
  MembersService: {
    generateNextMemberNumber: async () => state.generatedMemberNumber,
    create: async (payload: Record<string, unknown>) => {
      state.memberCreatePayload = payload;
      return { id: "member-1" };
    },
  },
}));

const { UsersService } =
  await import("../src/server/services/users.service.ts?users-member-sync");

describe("UsersService member sync", () => {
  beforeEach(() => {
    state.appUserRole = "MEMBER";
    state.existingMember = null;
    state.generatedMemberNumber = "M-0007";
    state.memberCreatePayload = null;
    state.memberUsers = [];
  });

  it("creates member profile when created user role is MEMBER", async () => {
    await UsersService.create({
      saccoId: "sacco-1",
      email: "member1@example.com",
      fullName: "Member One",
      role: "MEMBER",
    });

    expect(state.memberCreatePayload).toEqual({
      saccoId: "sacco-1",
      memberNumber: "M-0007",
      fullName: "Member One",
      email: "member1@example.com",
    });
  });

  it("skips member profile creation when role is not MEMBER", async () => {
    state.appUserRole = "TREASURER";

    await UsersService.create({
      saccoId: "sacco-1",
      email: "staff1@example.com",
      fullName: "Staff One",
      role: "TREASURER",
    });

    expect(state.memberCreatePayload).toBeNull();
  });

  it("syncs existing MEMBER users into members table", async () => {
    state.memberUsers = [
      {
        id: "app-user-1",
        saccoId: "sacco-1",
        email: "member1@example.com",
        fullName: "Member One",
      },
    ];
    state.existingMember = null;
    state.generatedMemberNumber = "M-0042";

    const result = await UsersService.syncExistingMemberUsers({
      saccoId: "sacco-1",
    });

    expect(result).toEqual({
      scanned: 1,
      created: 1,
      skipped: 0,
      failed: 0,
    });
    expect(state.memberCreatePayload).toEqual({
      saccoId: "sacco-1",
      memberNumber: "M-0042",
      fullName: "Member One",
      email: "member1@example.com",
    });
  });
});

afterAll(() => {
  mock.restore();
});
