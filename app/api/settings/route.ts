import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { SettingsService } from "@/src/server/services/settings.service";

export const GET = withApiHandler(async (_request: NextRequest) => {
  await requireRoles([
    "SACCO_ADMIN",
    "SUPER_ADMIN",
    "TREASURER",
    "AUDITOR",
    "LOAN_OFFICER",
  ]);
  const { saccoId } = await requireSaccoContext();
  const settings = await SettingsService.get(saccoId);
  return ok(settings);
});

export const PATCH = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = await request.json();
  const settings = await SettingsService.update(saccoId, payload, actorId);
  return ok(settings);
});
