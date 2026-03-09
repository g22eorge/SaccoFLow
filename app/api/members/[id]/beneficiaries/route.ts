import { NextRequest } from "next/server";
import { z } from "zod";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";

const beneficiarySchema = z.object({
  fullName: z.string().min(2),
  relationship: z.string().min(2),
  phone: z.string().optional(),
  allocationPercent: z.coerce.number().positive().max(100),
  isPrimary: z.boolean().optional(),
});

export const GET = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "LOAN_OFFICER", "MEMBER"]);
    const { saccoId } = await requireSaccoContext();
    const { id: memberId } = await context.params;
    const { prisma } = await import("@/src/server/db/prisma");

    const beneficiaries = await prisma.memberBeneficiary.findMany({
      where: { saccoId, memberId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
    return ok(beneficiaries);
  },
);

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "MEMBER"]);
    const { saccoId } = await requireSaccoContext();
    const { id: memberId } = await context.params;
    const { prisma } = await import("@/src/server/db/prisma");
    const parsed = beneficiarySchema.parse(await request.json());

    const existing = await prisma.memberBeneficiary.findMany({
      where: { saccoId, memberId },
      select: { allocationPercent: true, isPrimary: true },
    });
    const existingTotal = existing.reduce(
      (sum: number, row: { allocationPercent: { toString: () => string } }) =>
        sum + Number(row.allocationPercent.toString()),
      0,
    );
    if (existingTotal + parsed.allocationPercent > 100) {
      throw new Error("Total beneficiary allocation cannot exceed 100%");
    }

    const createdRecord = await prisma.$transaction(async (tx) => {
      if (parsed.isPrimary) {
        await tx.memberBeneficiary.updateMany({
          where: { saccoId, memberId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.memberBeneficiary.create({
        data: {
          saccoId,
          memberId,
          fullName: parsed.fullName,
          relationship: parsed.relationship,
          phone: parsed.phone,
          allocationPercent: parsed.allocationPercent,
          isPrimary: Boolean(parsed.isPrimary),
        },
      });
    });

    return created(createdRecord);
  },
);
