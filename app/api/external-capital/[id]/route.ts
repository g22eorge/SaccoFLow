import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";

export const PATCH = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"]);
    const { saccoId, id: actorId } = await requireSaccoContext();
    const { id } = await context.params;
    const payload = await request.json();
    const updated = await ExternalCapitalService.updateStatus({
      saccoId,
      id,
      actorId,
      payload,
    });
    return ok(updated);
  },
);
