import { NextRequest } from "next/server";
import { MembersService } from "@/src/server/services/members.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId } = await requireSaccoContext();
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59`) : undefined;
  const members = await MembersService.list({
    saccoId,
    search,
    page,
    from: fromDate,
    to: toDate,
  });
  return ok(members);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = { ...(await request.json()), saccoId };
  const member = await MembersService.create(payload, actorId);
  return created(member);
});
