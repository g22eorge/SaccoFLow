import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/prisma";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
type AssumedTenantContext = {
  saccoId: string;
  saccoCode: string;
  reason: string;
  startedAtIso: string;
};

type AppUserContext = {
  id: string;
  role: Role;
  saccoId: string;
  assumedTenant?: AssumedTenantContext;
};

export const PLATFORM_ASSUME_COOKIE = "platform_assume_tenant";

const parseAssumedTenantCookie = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      saccoId?: unknown;
      saccoCode?: unknown;
      reason?: unknown;
      startedAtIso?: unknown;
    };

    if (
      typeof parsed.saccoId !== "string" ||
      typeof parsed.saccoCode !== "string" ||
      typeof parsed.reason !== "string" ||
      typeof parsed.startedAtIso !== "string"
    ) {
      return null;
    }

    return {
      saccoId: parsed.saccoId,
      saccoCode: parsed.saccoCode,
      reason: parsed.reason,
      startedAtIso: parsed.startedAtIso,
    };
  } catch {
    return null;
  }
};

export const getAssumedTenant = async () => {
  const store = await cookies();
  return parseAssumedTenantCookie(store.get(PLATFORM_ASSUME_COOKIE)?.value);
};

class UnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = status;
  }
}

export const requireAuth = async (): Promise<NonNullable<Session>> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return session;
};

export const getSession = async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
};

export const requireRoles = async (roles: Role[]) => {
  const session = await getSession();
  if (!session?.user?.email) {
    throw new UnauthorizedError("Missing authenticated user");
  }

  const appUser = await prisma.appUser.findFirst({
    where: { email: session.user.email, isActive: true },
    select: { role: true, id: true, saccoId: true },
  });

  if (!appUser) {
    throw new UnauthorizedError("Insufficient role", 403);
  }

  if (String(appUser.role) === "PLATFORM_SUPER_ADMIN") {
    if (roles.some((role) => String(role) === "PLATFORM_SUPER_ADMIN")) {
      return appUser;
    }

    const assumedTenant = await getAssumedTenant();
    if (assumedTenant && roles.includes("SUPER_ADMIN")) {
      return { ...appUser, role: "SUPER_ADMIN" as Role };
    }
  }

  if (!roles.includes(appUser.role)) {
    throw new UnauthorizedError("Insufficient role", 403);
  }

  return appUser;
};

export const requireSaccoContext = async (): Promise<AppUserContext> => {
  const session = await getSession();
  if (!session?.user?.email) {
    throw new UnauthorizedError("Missing authenticated user");
  }

  const appUser = await prisma.appUser.findFirst({
    where: { email: session.user.email, isActive: true },
    select: { id: true, role: true, saccoId: true },
  });

  if (!appUser) {
    throw new UnauthorizedError("Missing SACCO profile");
  }

  if (String(appUser.role) !== "PLATFORM_SUPER_ADMIN") {
    return appUser;
  }

  const assumedTenant = await getAssumedTenant();
  if (!assumedTenant) {
    return appUser;
  }

  const tenant = await prisma.sacco.findUnique({
    where: { id: assumedTenant.saccoId },
    select: { id: true, code: true },
  });

  if (!tenant) {
    return appUser;
  }

  return {
    id: appUser.id,
    role: "SUPER_ADMIN" as Role,
    saccoId: tenant.id,
    assumedTenant: {
      saccoId: tenant.id,
      saccoCode: tenant.code,
      reason: assumedTenant.reason,
      startedAtIso: assumedTenant.startedAtIso,
    },
  };
};

export const requireWriteRoles = requireRoles;

export const requirePlatformSuperAdmin = async () => {
  const session = await getSession();
  if (!session?.user?.email) {
    throw new UnauthorizedError("Missing authenticated user");
  }

  const appUser = await prisma.appUser.findFirst({
    where: { email: session.user.email, isActive: true },
    select: { id: true, role: true, saccoId: true },
  });

  if (!appUser || String(appUser.role) !== "PLATFORM_SUPER_ADMIN") {
    throw new UnauthorizedError("Platform access required", 403);
  }

  return appUser;
};

export { UnauthorizedError };
