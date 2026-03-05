import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const state = {
  session: null as { user?: { email?: string } } | null,
  appUser: null as { id?: string; role?: string; saccoId?: string } | null,
};

mock.module("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
  }),
}));

mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

mock.module("@/src/server/auth/auth", () => ({
  auth: {
    api: {
      getSession: async () => state.session,
    },
  },
}));

mock.module("@/src/server/db/prisma", () => ({
  prisma: {
    appUser: {
      findFirst: async () => state.appUser,
    },
  },
}));

const { requireAuth, requireRoles, requireSaccoContext, UnauthorizedError } =
  await import("../src/server/auth/rbac.ts?rbac-test");

describe("RBAC", () => {
  beforeEach(() => {
    state.session = null;
    state.appUser = null;
  });

  it("redirects when no session exists", async () => {
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("allows user with required role", async () => {
    state.session = { user: { email: "admin@example.com" } };
    state.appUser = { role: "SACCO_ADMIN" };

    const result = await requireRoles(["SACCO_ADMIN"]);
    expect(result.role).toBe("SACCO_ADMIN");
  });

  it("returns forbidden UnauthorizedError for insufficient role", async () => {
    state.session = { user: { email: "auditor@example.com" } };
    state.appUser = { role: "AUDITOR" };

    try {
      await requireRoles(["SACCO_ADMIN"]);
      throw new Error("Expected requireRoles to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as InstanceType<typeof UnauthorizedError>).status).toBe(
        403,
      );
    }
  });

  it("requires explicit SUPER_ADMIN in required role list", async () => {
    state.session = { user: { email: "super@example.com" } };
    state.appUser = { role: "SUPER_ADMIN" };

    await expect(requireRoles(["TREASURER"])).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    const result = await requireRoles(["SUPER_ADMIN"]);
    expect(result.role).toBe("SUPER_ADMIN");
  });

  it("returns sacco context for active app user", async () => {
    state.session = { user: { email: "staff@example.com" } };
    state.appUser = { id: "app-1", role: "TREASURER", saccoId: "sacco-1" };

    const context = await requireSaccoContext();
    expect(context).toEqual({
      id: "app-1",
      role: "TREASURER",
      saccoId: "sacco-1",
    });
  });
});

afterAll(() => {
  mock.restore();
});
