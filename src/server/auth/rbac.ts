import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/prisma";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
type AppUserContext = { id: string; role: Role; saccoId: string };

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
    select: { role: true },
  });

  if (!appUser) {
    throw new UnauthorizedError("Insufficient role", 403);
  }

  if (appUser.role === "SUPER_ADMIN") {
    return appUser;
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

  return appUser;
};

export const requireWriteRoles = requireRoles;

export { UnauthorizedError };
