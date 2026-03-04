import { NextRequest } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { ok, withApiHandler } from "@/src/server/api/http";

export const PATCH = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
    const { id: actorId, saccoId, role } = await requireSaccoContext();
    const { id } = await context.params;
    const body = await request.json();

    const updated = await UsersService.updateAccess({
      saccoId,
      targetUserId: id,
      actorRole: role,
      actorId,
      role: body?.role,
      isActive: body?.isActive,
    });

    return ok(updated);
  },
);
