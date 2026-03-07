import { ok, withApiHandler } from "@/src/server/api/http";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { MemberPaymentsService } from "@/src/server/services/member-payments.service";

export const GET = withApiHandler(async () => {
  const { saccoId, role } = await requireSaccoContext();
  if (role !== "MEMBER") {
    throw new Error("Only members can view member payment intents");
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

  const intents = await MemberPaymentsService.listMemberIntents(saccoId, member.id, 12);
  return ok(
    intents.map((intent) => ({
      ...intent,
      amount: intent.amount.toString(),
      createdAt: intent.createdAt.toISOString(),
      processedAt: intent.processedAt?.toISOString() ?? null,
    })),
  );
});
