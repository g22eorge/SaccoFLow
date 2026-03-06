import { NextRequest } from "next/server";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"]);
  const { saccoId } = await requireSaccoContext();
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const type = request.nextUrl.searchParams.get("type") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const source = request.nextUrl.searchParams.get("source") ?? undefined;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const rows = await ExternalCapitalService.list({
    saccoId,
    page,
    type,
    status,
    source,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return ok(rows);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
  const { saccoId, id: actorId } = await requireSaccoContext();
  const payload = await request.json();
  const txn = await ExternalCapitalService.record(
    {
      ...payload,
      saccoId,
    },
    actorId,
  );
  return created(txn);
});
