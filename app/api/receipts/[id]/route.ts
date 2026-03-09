import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ReceiptService } from "@/src/server/services/receipt.service";

const patchSchema = z.object({
  action: z.enum(["VOID", "REISSUE"]),
  reason: z.string().min(3).max(240).optional(),
});

export const GET = withApiHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"]);
    const { saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    const receipt = await ReceiptService.getById(saccoId, id);
    return ok(receipt);
  },
);

export const PATCH = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
    const { saccoId } = await requireSaccoContext();
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());

    if (body.action === "VOID") {
      const receipt = await ReceiptService.void({
        saccoId,
        id,
        reason: body.reason ?? "Void requested by authorized officer",
      });
      return ok(receipt);
    }

    const receipt = await ReceiptService.reissue({ saccoId, id });
    return ok(receipt);
  },
);
