import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";

const schema = z.object({
  reason: z.string().min(3).max(300),
  amount: z.coerce.number().positive().optional(),
});

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
    const { saccoId, id: actorId } = await requireSaccoContext();
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const correction = await ExternalCapitalService.correct({
      saccoId,
      id,
      actorId,
      reason: payload.reason,
      amount: payload.amount,
    });
    return ok(correction);
  },
);
