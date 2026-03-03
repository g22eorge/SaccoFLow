import { NextRequest } from "next/server";
import { MembersService } from "@/src/server/services/members.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId } = await requireSaccoContext();
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const members = await MembersService.list({ saccoId, search, page });
  return ok(members);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = { ...(await request.json()), saccoId };
  const member = await MembersService.create(payload, actorId);
  return created(member);
});
