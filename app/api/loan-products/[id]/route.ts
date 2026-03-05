import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { LoanProductsService } from "@/src/server/services/loan-products.service";

export const PATCH = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "LOAN_OFFICER"]);
    const { saccoId, id: actorId } = await requireSaccoContext();
    const { id } = await context.params;
    const payload = await request.json();
    const product = await LoanProductsService.update(saccoId, id, payload, actorId);
    return ok(product);
  },
);
