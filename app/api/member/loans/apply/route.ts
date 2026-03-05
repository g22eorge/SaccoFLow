import { NextRequest } from "next/server";
import { withApiHandler, created } from "@/src/server/api/http";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { LoansService } from "@/src/server/services/loans.service";

export const POST = withApiHandler(async (request: NextRequest) => {
  const { saccoId, role, id: actorId } = await requireSaccoContext();
  if (role !== "MEMBER") {
    throw new Error("Only members can submit self-service loan requests");
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
  const loan = await LoansService.apply(
    {
      saccoId,
      memberId: member.id,
      loanProductId: body?.loanProductId,
      principalAmount: body?.principalAmount,
      termMonths: body?.termMonths,
    },
    actorId,
  );

  return created(loan);
});
