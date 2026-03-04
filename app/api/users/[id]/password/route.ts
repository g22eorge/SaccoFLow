import { NextRequest } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { ok, withApiHandler } from "@/src/server/api/http";

export const POST = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
    const { id: actorId, saccoId, role } = await requireSaccoContext();
    const { id } = await context.params;
    const body = await request.json();

    const result = await UsersService.resetPassword({
      saccoId,
      targetUserId: id,
      actorRole: role,
      actorId,
      password: body?.password,
    });

    return ok(result);
  },
);
