import { NextRequest } from "next/server";
import { MembersService } from "@/src/server/services/members.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    const { saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    const member = await MembersService.getById(id, saccoId);
    return ok(member);
  },
);

export const PATCH = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
    const { id: actorId, saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    const payload = await request.json();
    const member = await MembersService.update(id, saccoId, payload, actorId);
    return ok(member);
  },
);

export const DELETE = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
    const { id: actorId, saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    await MembersService.remove(id, saccoId, actorId);
    return ok({ deleted: true });
  },
);
