import { NextRequest } from "next/server";
import { z } from "zod";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";

const createKycSchema = z.object({
  documentType: z.string().min(2),
  documentNumber: z.string().optional(),
  documentUrl: z.string().url().optional(),
  notes: z.string().max(400).optional(),
});

const updateKycStatusSchema = z.object({
  kycRecordId: z.string().min(1),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  notes: z.string().max(400).optional(),
});

export const GET = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "LOAN_OFFICER"]);
    const { saccoId } = await requireSaccoContext();
    const { id: memberId } = await context.params;

    const { prisma } = await import("@/src/server/db/prisma");
    const records = await prisma.memberKycRecord.findMany({
      where: { saccoId, memberId },
      orderBy: { createdAt: "desc" },
    });

    return ok(records);
  },
);

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"]);
    const { saccoId, id: actorId } = await requireSaccoContext();
    const { id: memberId } = await context.params;
    const body = await request.json();

    const { prisma } = await import("@/src/server/db/prisma");

    if (body?.kycRecordId && body?.status) {
      const parsedStatus = updateKycStatusSchema.parse(body);
      const updated = await prisma.memberKycRecord.update({
        where: { id: parsedStatus.kycRecordId },
        data: {
          status: parsedStatus.status,
          notes: parsedStatus.notes,
          verifiedById: parsedStatus.status === "PENDING" ? null : actorId,
          verifiedAt: parsedStatus.status === "PENDING" ? null : new Date(),
        },
      });
      return ok(updated);
    }

    const parsed = createKycSchema.parse(body);
    const record = await prisma.memberKycRecord.create({
      data: {
        saccoId,
        memberId,
        documentType: parsed.documentType,
        documentNumber: parsed.documentNumber,
        documentUrl: parsed.documentUrl,
        notes: parsed.notes,
      },
    });

    return created(record);
  },
);
