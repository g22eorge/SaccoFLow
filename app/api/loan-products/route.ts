import { NextRequest } from "next/server";
import { ok, created, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { LoanProductsService } from "@/src/server/services/loan-products.service";

export const GET = withApiHandler(async () => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "LOAN_OFFICER", "TREASURER", "AUDITOR"]);
  const { saccoId } = await requireSaccoContext();
  const products = await LoanProductsService.list(saccoId);
  return ok(products);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "LOAN_OFFICER"]);
  const { saccoId, id: actorId } = await requireSaccoContext();
  const payload = await request.json();
  const product = await LoanProductsService.create(saccoId, payload, actorId);
  return created(product);
});
