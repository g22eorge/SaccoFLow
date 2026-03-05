import { cookies } from "next/headers";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import {
  getAssumedTenant,
  getSession,
  PLATFORM_ASSUME_COOKIE,
  requirePlatformSuperAdmin,
} from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";

const schema = z.object({
  saccoCode: z.string().min(2).max(64),
  reason: z.string().min(8).max(240),
});

export const POST = withApiHandler(async (request: Request) => {
  const actor = await requirePlatformSuperAdmin();
  const session = await getSession();
  const parsed = schema.parse(await request.json());

  const tenant = await prisma.sacco.findUnique({
    where: { code: parsed.saccoCode.trim() },
    select: { id: true, code: true, name: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found for supplied SACCO code");
  }

  const startedAtIso = new Date().toISOString();
  const state = {
    saccoId: tenant.id,
    saccoCode: tenant.code,
    reason: parsed.reason.trim(),
    startedAtIso,
  };

  const store = await cookies();
  store.set(PLATFORM_ASSUME_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

  await AuditService.record({
    saccoId: tenant.id,
    actorId: actor.id,
    action: "ASSUME_TENANT_START",
    entity: "PlatformSupportSession",
    entityId: `${actor.id}:${tenant.id}:${Date.now()}`,
    after: {
      tenantCode: tenant.code,
      tenantName: tenant.name,
      reason: state.reason,
      startedAtIso,
      actorEmail: session?.user?.email ?? null,
    },
  });

  return ok({
    saccoId: tenant.id,
    saccoCode: tenant.code,
    saccoName: tenant.name,
    reason: state.reason,
    startedAtIso,
  });
});

export const DELETE = withApiHandler(async () => {
  const actor = await requirePlatformSuperAdmin();
  const current = await getAssumedTenant();
  const store = await cookies();
  store.delete(PLATFORM_ASSUME_COOKIE);

  if (current) {
    await AuditService.record({
      saccoId: current.saccoId,
      actorId: actor.id,
      action: "ASSUME_TENANT_END",
      entity: "PlatformSupportSession",
      entityId: `${actor.id}:${current.saccoId}:${Date.now()}`,
      after: {
        tenantCode: current.saccoCode,
        reason: current.reason,
        startedAtIso: current.startedAtIso,
        endedAtIso: new Date().toISOString(),
      },
    });
  }

  return ok({ cleared: true });
});
