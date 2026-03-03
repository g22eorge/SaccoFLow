import { NextRequest } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { created, ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
  const { saccoId } = await requireSaccoContext();
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const users = await UsersService.list({ saccoId, page });
  return ok(users);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const body = await request.json();

  if (body?.role === "SUPER_ADMIN") {
    await requireRoles(["SUPER_ADMIN"]);
  }

  const payload = { ...body, saccoId };
  const user = await UsersService.create(payload, actorId);
  return created(user);
});
