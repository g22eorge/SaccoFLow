import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/src/server/api/http";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { LoansService } from "@/src/server/services/loans.service";

export const POST = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    const { saccoId, role, id: actorId } = await requireSaccoContext();
    if (role !== "MEMBER") {
      throw new Error("Only members can approve loan schedules");
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

    const { id } = await context.params;
    const result = await LoansService.approveScheduleByMember({
      loanId: id,
      saccoId,
      memberId: member.id,
      actorId,
    });

    return ok(result);
  },
);
