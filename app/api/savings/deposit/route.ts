import { NextRequest } from "next/server";
import { SavingsService } from "@/src/server/services/savings.service";
import { requireSaccoContext, requireWriteRoles } from "@/src/server/auth/rbac";
import { created, withApiHandler } from "@/src/server/api/http";
import { SettingsService } from "@/src/server/services/settings.service";

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireWriteRoles(["SACCO_ADMIN", "TREASURER"]);
  const { id: actorId, saccoId } = await requireSaccoContext();
  await SettingsService.assertCapitalEnabled(saccoId, "SAVINGS");
  const payload = { ...(await request.json()), type: "DEPOSIT", saccoId };
  const transaction = await SavingsService.deposit(payload, actorId);
  return created(transaction);
});
