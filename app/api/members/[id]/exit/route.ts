import { NextRequest } from "next/server";
import { z } from "zod";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";

const createExitCaseSchema = z.object({
  reason: z.string().max(400).optional(),
  notes: z.string().max(500).optional(),
});

const updateExitCaseSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"]),
  notes: z.string().max(500).optional(),
});

export const GET = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "MEMBER"]);
    const { saccoId } = await requireSaccoContext();
    const { id: memberId } = await context.params;
    const { prisma } = await import("@/src/server/db/prisma");

    const cases = await prisma.memberExitCase.findMany({
      where: { saccoId, memberId },
      orderBy: { requestedAt: "desc" },
    });
    return ok(cases);
  },
);

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "MEMBER"]);
    const { saccoId, id: actorId } = await requireSaccoContext();
    const { id: memberId } = await context.params;
    const body = await request.json();
    const { prisma } = await import("@/src/server/db/prisma");

    if (body?.caseId && body?.status) {
      await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
      const parsedUpdate = updateExitCaseSchema.parse(body);
      const updated = await prisma.memberExitCase.update({
        where: { id: parsedUpdate.caseId },
        data: {
          status: parsedUpdate.status,
          notes: parsedUpdate.notes,
          reviewedById: actorId,
          reviewedAt: new Date(),
          completedAt: parsedUpdate.status === "COMPLETED" ? new Date() : null,
        },
      });
      return ok(updated);
    }

    const parsed = createExitCaseSchema.parse(body);
    const createdCase = await prisma.memberExitCase.create({
      data: {
        saccoId,
        memberId,
        reason: parsed.reason,
        notes: parsed.notes,
        requestedById: actorId,
      },
    });

    return created(createdCase);
  },
);
