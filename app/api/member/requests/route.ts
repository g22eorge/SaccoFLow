import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler, created, ok } from "@/src/server/api/http";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";

const memberRequestSchema = z.object({
  type: z.enum(["SAVINGS_WITHDRAWAL", "SHARE_REDEMPTION"]),
  amount: z.coerce.number().positive(),
  note: z.string().max(240).optional(),
});

export const GET = withApiHandler(async () => {
  const { saccoId, role } = await requireSaccoContext();
  if (role !== "MEMBER") {
    throw new Error("Only members can view self-service requests");
  }

  const session = await getSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    throw new Error("Missing authenticated member email");
  }

  const member = await prisma.member.findFirst({
    where: { saccoId, email },
    select: { id: true },
  });
  if (!member) {
    return ok([]);
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "MemberRequest",
      entityId: { startsWith: `${member.id}:` },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const requests = logs.map((log) => {
    const after = log.afterJson ? JSON.parse(log.afterJson) : {};
    return {
      id: log.id,
      type: after.type ?? "UNKNOWN",
      amount: after.amount ?? "0",
      status: after.status ?? "PENDING",
      note: after.note ?? null,
      createdAt: log.createdAt,
    };
  });

  return ok(requests);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const { saccoId, role, id: actorId } = await requireSaccoContext();
  if (role !== "MEMBER") {
    throw new Error("Only members can submit self-service requests");
  }

  const session = await getSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    throw new Error("Missing authenticated member email");
  }

  const member = await prisma.member.findFirst({
    where: { saccoId, email },
    select: { id: true },
  });
  if (!member) {
    throw new Error("Member profile not linked");
  }

  const body = await request.json();
  const parsed = memberRequestSchema.parse(body);
  const requestId = crypto.randomUUID();

  await AuditService.record({
    saccoId,
    actorId,
    action: "REQUEST",
    entity: "MemberRequest",
    entityId: `${member.id}:${requestId}`,
    after: {
      type: parsed.type,
      amount: parsed.amount,
      note: parsed.note ?? null,
      status: "PENDING",
    },
  });

  return created({
    id: requestId,
    type: parsed.type,
    amount: parsed.amount,
    status: "PENDING",
    note: parsed.note ?? null,
  });
});
