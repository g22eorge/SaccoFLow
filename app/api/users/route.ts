import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { created, ok, withApiHandler } from "@/src/server/api/http";

const assignableRolesByActor: Record<Role, Role[]> = {
  SUPER_ADMIN: ["SACCO_ADMIN", "TREASURER", "LOAN_OFFICER", "AUDITOR", "MEMBER"],
  SACCO_ADMIN: ["TREASURER", "LOAN_OFFICER", "AUDITOR", "MEMBER"],
  TREASURER: ["MEMBER"],
  LOAN_OFFICER: ["MEMBER"],
  AUDITOR: ["MEMBER"],
  MEMBER: [],
};

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
  const { saccoId } = await requireSaccoContext();
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const users = await UsersService.list({ saccoId, page });
  return ok(users);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
  const { id: actorId, saccoId, role } = await requireSaccoContext();
  const body = await request.json();

  const targetRole = body?.role as Role | undefined;
  if (!targetRole || !assignableRolesByActor[role]?.includes(targetRole)) {
    throw new Error("You are not allowed to assign this role");
  }

  const payload = { ...body, saccoId };
  const user = await UsersService.create(payload, actorId);
  return created(user);
});
