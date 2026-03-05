import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { getSession, requirePlatformSuperAdmin } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { auth } from "@/src/server/auth/auth";
import { AuditService } from "@/src/server/services/audit.service";

const updateSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((value) => value.fullName !== undefined || value.password !== undefined, {
    message: "At least one field is required",
  });

export const GET = withApiHandler(async () => {
  const actor = await requirePlatformSuperAdmin();
  const user = await prisma.appUser.findUnique({
    where: { id: actor.id },
    select: {
      email: true,
      fullName: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error("Profile not found");
  }

  return ok(user);
});

export const PATCH = withApiHandler(async (request: Request) => {
  const actor = await requirePlatformSuperAdmin();
  const session = await getSession();
  const payload = updateSchema.parse(await request.json());

  const current = await prisma.appUser.findUnique({
    where: { id: actor.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      authUserId: true,
      saccoId: true,
    },
  });

  if (!current) {
    throw new Error("Profile not found");
  }

  if (payload.fullName !== undefined) {
    await prisma.appUser.update({
      where: { id: current.id },
      data: { fullName: payload.fullName.trim() },
    });

    await prisma.user.update({
      where: { id: current.authUserId },
      data: { name: payload.fullName.trim() },
    });
  }

  if (payload.password) {
    const context = await auth.$context;
    const accounts = await context.internalAdapter.findAccounts(current.authUserId);
    const credential = accounts.find((account) => account.providerId === "credential");
    const passwordHash = await context.password.hash(payload.password);

    if (credential) {
      await prisma.account.update({
        where: { id: credential.id },
        data: { password: passwordHash },
      });
    } else {
      await context.internalAdapter.linkAccount({
        userId: current.authUserId,
        providerId: "credential",
        accountId: current.authUserId,
        password: passwordHash,
      });
    }
  }

  await AuditService.record({
    saccoId: current.saccoId,
    actorId: current.id,
    action: "PLATFORM_PROFILE_UPDATE",
    entity: "PlatformProfile",
    entityId: current.id,
    before: {
      fullName: current.fullName,
      email: current.email,
    },
    after: {
      fullName: payload.fullName ?? current.fullName,
      email: current.email,
      passwordChanged: Boolean(payload.password),
      actorEmail: session?.user?.email ?? null,
    },
  });

  return ok({
    email: current.email,
    fullName: payload.fullName ?? current.fullName,
    role: current.role,
    passwordChanged: Boolean(payload.password),
  });
});
