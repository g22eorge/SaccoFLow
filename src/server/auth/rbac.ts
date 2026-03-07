import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/prisma";
import {
  TWO_FACTOR_SESSION_COOKIE,
  getSessionTokenFromRequestCookies,
} from "@/src/lib/auth-2fa";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

type AssumedTenantContext = {
  saccoId: string;
  saccoCode: string;
  reason: string;
  startedAtIso: string;
};

export type TenantOption = {
  saccoId: string;
  saccoCode: string;
  saccoName: string;
  role: Role;
};

type AppUserContext = {
  id: string;
  role: Role;
  saccoId: string;
  assumedTenant?: AssumedTenantContext;
  tenantOptions?: TenantOption[];
};

export const PLATFORM_ASSUME_COOKIE = "platform_assume_tenant";
export const ACTIVE_SACCO_COOKIE = "active_sacco_context";

class UnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = status;
  }
}

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

const parseActiveSaccoCookie = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { saccoId?: unknown };
    if (typeof parsed.saccoId !== "string") {
      return null;
    }
    return parsed.saccoId;
  } catch {
    return null;
  }
};

export const getAssumedTenant = async () => {
  const store = await cookies();
  return parseAssumedTenantCookie(store.get(PLATFORM_ASSUME_COOKIE)?.value);
};

const getActiveSaccoId = async () => {
  const store = await cookies();
  return parseActiveSaccoCookie(store.get(ACTIVE_SACCO_COOKIE)?.value);
};

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

const requireSecondFactor = async (sessionUserId: string) => {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.DEMO_OTP_PREVIEW === "true"
  ) {
    return;
  }

  const cookieStore = await cookies();
  const sessionToken = getSessionTokenFromRequestCookies(cookieStore);
  const twoFactorSessionToken = cookieStore.get(TWO_FACTOR_SESSION_COOKIE)?.value;

  if (!sessionToken || twoFactorSessionToken !== sessionUserId) {
    throw new UnauthorizedError("Two-factor verification required", 401);
  }
};

const resolveAppContext = async (session: NonNullable<Session>): Promise<AppUserContext> => {
  const appUser = await prisma.appUser.findFirst({
    where: {
      authUserId: session.user.id,
      isActive: true,
    },
    select: { id: true, role: true, saccoId: true },
  });

  if (!appUser) {
    throw new UnauthorizedError("Missing SACCO profile", 403);
  }

  if (String(appUser.role) === "PLATFORM_SUPER_ADMIN") {
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
      role: "SUPER_ADMIN",
      saccoId: tenant.id,
      assumedTenant: {
        saccoId: tenant.id,
        saccoCode: tenant.code,
        reason: assumedTenant.reason,
        startedAtIso: assumedTenant.startedAtIso,
      },
    };
  }

  const tenantAccesses = await prisma.appUserTenantAccess.findMany({
    where: {
      authUserId: session.user.id,
      isActive: true,
    },
    select: {
      saccoId: true,
      role: true,
      sacco: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  const tenantMap = new Map<string, TenantOption>();
  for (const access of tenantAccesses) {
    tenantMap.set(access.saccoId, {
      saccoId: access.sacco.id,
      saccoCode: access.sacco.code,
      saccoName: access.sacco.name,
      role: access.role,
    });
  }

  if (!tenantMap.has(appUser.saccoId)) {
    const primaryTenant = await prisma.sacco.findUnique({
      where: { id: appUser.saccoId },
      select: { id: true, code: true, name: true },
    });
    if (primaryTenant) {
      tenantMap.set(primaryTenant.id, {
        saccoId: primaryTenant.id,
        saccoCode: primaryTenant.code,
        saccoName: primaryTenant.name,
        role: appUser.role,
      });
    }
  }

  const tenantOptions = [...tenantMap.values()];
  const requestedSaccoId = await getActiveSaccoId();
  const selectedTenant =
    (requestedSaccoId ? tenantMap.get(requestedSaccoId) : null) ??
    tenantMap.get(appUser.saccoId) ??
    tenantOptions[0];

  if (!selectedTenant) {
    return appUser;
  }

  return {
    id: appUser.id,
    role: selectedTenant.role,
    saccoId: selectedTenant.saccoId,
    tenantOptions,
  };
};

export const listAccessibleTenants = async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new UnauthorizedError("Missing authenticated user");
  }
  const context = await resolveAppContext(session);
  return {
    activeSaccoId: context.saccoId,
    activeRole: context.role,
    tenants: context.tenantOptions ?? [],
  };
};

export const requireRoles = async (roles: Role[]) => {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new UnauthorizedError("Missing authenticated user");
  }
  await requireSecondFactor(session.user.id);

  const context = await resolveAppContext(session);
  if (!roles.includes(context.role)) {
    throw new UnauthorizedError("Insufficient role", 403);
  }

  return context;
};

export const requireSaccoContext = async (): Promise<AppUserContext> => {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new UnauthorizedError("Missing authenticated user");
  }
  await requireSecondFactor(session.user.id);
  return resolveAppContext(session);
};

export const requireWriteRoles = requireRoles;

export const requirePlatformSuperAdmin = async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new UnauthorizedError("Missing authenticated user");
  }
  await requireSecondFactor(session.user.id);

  const appUser = await prisma.appUser.findFirst({
    where: { authUserId: session.user.id, isActive: true },
    select: { id: true, role: true, saccoId: true },
  });

  if (!appUser || String(appUser.role) !== "PLATFORM_SUPER_ADMIN") {
    throw new UnauthorizedError("Platform access required", 403);
  }

  return appUser;
};

export { UnauthorizedError };
