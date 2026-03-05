import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { SettingsService } from "@/src/server/services/settings.service";

const schema = z.object({
  versionId: z.string().min(1),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"]);
  const { saccoId, id: actorId } = await requireSaccoContext();
  const parsed = schema.parse(await request.json());
  const settings = await SettingsService.rollbackToVersion(
    saccoId,
    parsed.versionId,
    actorId,
  );
  return ok(settings);
});
