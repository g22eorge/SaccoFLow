import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { SettingsService } from "@/src/server/services/settings.service";

export const GET = withApiHandler(async () => {
  await requireRoles([
    "SACCO_ADMIN",
    "SUPER_ADMIN",
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "AUDITOR",
    "LOAN_OFFICER",
  ]);
  const { saccoId } = await requireSaccoContext();
  const settings = await SettingsService.get(saccoId);
  return ok(settings);
});

export const PATCH = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"]);
  const { id: actorId, saccoId, role } = await requireSaccoContext();
  const payload = await request.json();
  if (role !== "SUPER_ADMIN") {
    const current = await SettingsService.get(saccoId);
    const requestedPolicy = payload?.documentExportPolicy;
    if (
      requestedPolicy &&
      JSON.stringify(requestedPolicy) !== JSON.stringify(current.documentExportPolicy)
    ) {
      throw new Error("Only super admin can change document export policy");
    }
  }
  const settings = await SettingsService.update(saccoId, payload, actorId);
  return ok(settings);
});
