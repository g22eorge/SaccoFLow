import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler, ok } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(240).optional(),
});

export const PATCH = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
    const { saccoId, id: actorId } = await requireSaccoContext();
    const { id } = await context.params;
    const parsed = schema.parse(await request.json());

    const record = await prisma.auditLog.findFirst({
      where: {
        id,
        saccoId,
        entity: "MemberRequest",
      },
    });

    if (!record) {
      throw new Error("Member request not found");
    }

    const previous = record.afterJson ? JSON.parse(record.afterJson) : {};
    const updated = {
      ...previous,
      status: parsed.status,
      reviewNote: parsed.note ?? null,
      reviewedAt: new Date().toISOString(),
    };

    await prisma.auditLog.update({
      where: { id },
      data: {
        afterJson: JSON.stringify(updated),
      },
    });

    await AuditService.record({
      saccoId,
      actorId,
      action: "REVIEW_REQUEST",
      entity: "MemberRequest",
      entityId: record.entityId,
      before: previous,
      after: updated,
    });

    return ok(updated);
  },
);
