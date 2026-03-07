import { NextRequest } from "next/server";
import { z } from "zod";
import { created, withApiHandler } from "@/src/server/api/http";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { MemberPaymentsService } from "@/src/server/services/member-payments.service";

const checkoutSchema = z.object({
  type: z.enum(["SAVINGS_DEPOSIT", "SHARE_PURCHASE", "LOAN_REPAYMENT"]),
  amount: z.coerce.number().positive(),
  loanId: z.string().optional(),
  note: z.string().max(240).optional(),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const { saccoId, role, id: actorId } = await requireSaccoContext();
  if (role !== "MEMBER") {
    throw new Error("Only members can start member payment checkout");
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

  const body = checkoutSchema.parse(await request.json());
  const intent = await MemberPaymentsService.createCheckoutIntent({
    saccoId,
    memberId: member.id,
    type: body.type,
    amount: body.amount,
    loanId: body.loanId,
    note: body.note,
    actorId,
  });

  return created({
    id: intent.id,
    checkoutUrl: intent.checkoutUrl,
    checkoutReference: intent.checkoutReference,
    status: intent.status,
  });
});
