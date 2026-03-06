import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { auth } from "@/src/server/auth/auth";
import { AuditService } from "@/src/server/services/audit.service";

const schema = z.object({
  newPassword: z.string().min(8).max(128),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const { id: actorId, saccoId } = await requireSaccoContext();
  const parsed = schema.parse(await request.json());

  const profile = await prisma.appUser.findFirst({
    where: { id: actorId, saccoId, isActive: true },
    select: { id: true, authUserId: true },
  });
  if (!profile) {
    throw new Error("Profile not found");
  }

  const context = await auth.$context;
  const accounts = await context.internalAdapter.findAccounts(profile.authUserId);
  const credential = accounts.find((account) => account.providerId === "credential");
  const hash = await context.password.hash(parsed.newPassword);

  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { password: hash },
    });
  } else {
    await context.internalAdapter.linkAccount({
      userId: profile.authUserId,
      providerId: "credential",
      accountId: profile.authUserId,
      password: hash,
    });
  }

  await prisma.session.deleteMany({ where: { userId: profile.authUserId } });

  await AuditService.record({
    saccoId,
    actorId,
    action: "CHANGE_PASSWORD",
    entity: "AccountSecurity",
    entityId: actorId,
    after: { rotatedAt: new Date().toISOString() },
  });

  return ok({ success: true });
});
