import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";

const schema = z.object({
  sessionId: z.string().optional(),
});

export const DELETE = withApiHandler(async (request: NextRequest) => {
  const { id: actorId, saccoId } = await requireSaccoContext();
  const profile = await prisma.appUser.findFirst({
    where: { id: actorId, saccoId, isActive: true },
    select: { id: true, authUserId: true },
  });
  if (!profile) {
    throw new Error("Profile not found");
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.parse(body);

  const result = parsed.sessionId
    ? await prisma.session.deleteMany({
        where: {
          userId: profile.authUserId,
          id: parsed.sessionId,
        },
      })
    : await prisma.session.deleteMany({ where: { userId: profile.authUserId } });

  await AuditService.record({
    saccoId,
    actorId,
    action: "TERMINATE_SESSION",
    entity: "AccountSecurity",
    entityId: actorId,
    after: {
      terminatedCount: result.count,
      sessionId: parsed.sessionId ?? null,
    },
  });

  return ok({ terminatedCount: result.count });
});
