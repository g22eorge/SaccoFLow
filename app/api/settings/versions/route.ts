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
  const versions = await SettingsService.listVersions(saccoId, 20);
  return ok(versions);
});
