import { created, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { LoanProductsService } from "@/src/server/services/loan-products.service";

export const POST = withApiHandler(async () => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "LOAN_OFFICER"]);
  const { saccoId, id: actorId } = await requireSaccoContext();
  const rows = await LoanProductsService.seedStandardCatalog(saccoId, actorId);
  return created(rows);
});
