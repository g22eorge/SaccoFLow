import { NextRequest } from "next/server";
import { z } from "zod";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";

const guarantorSchema = z.object({
  guarantorMemberId: z.string().min(1),
  guaranteedAmount: z.coerce.number().positive(),
});

export const GET = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER", "AUDITOR"]);
    const { saccoId } = await requireSaccoContext();
    const { id: loanId } = await context.params;
    const { prisma } = await import("@/src/server/db/prisma");

    const guarantors = await prisma.loanGuarantorCommitment.findMany({
      where: { saccoId, loanId },
      orderBy: { createdAt: "desc" },
    });
    return ok(guarantors);
  },
);

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"]);
    const { saccoId } = await requireSaccoContext();
    const { id: loanId } = await context.params;
    const parsed = guarantorSchema.parse(await request.json());
    const { prisma } = await import("@/src/server/db/prisma");

    const commitment = await prisma.loanGuarantorCommitment.create({
      data: {
        saccoId,
        loanId,
        guarantorMemberId: parsed.guarantorMemberId,
        guaranteedAmount: parsed.guaranteedAmount,
        status: "ACTIVE",
      },
    });

    return created(commitment);
  },
);
