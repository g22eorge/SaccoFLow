import { z } from "zod";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import { BillingService } from "@/src/server/services/billing.service";

const webhookSchema = z.object({
  merchantReference: z.string().min(8),
  paymentStatus: z.enum(["COMPLETED", "FAILED", "PENDING"]),
  orderTrackingId: z.string().optional(),
  payload: z.unknown().optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const secret = process.env.PESAPAL_WEBHOOK_SECRET;
  if (secret) {
    const incoming = request.headers.get("x-pesapal-secret");
    if (incoming !== secret) {
      return fail("Invalid webhook signature", 401, "INVALID_SIGNATURE");
    }
  }

  const parsed = webhookSchema.parse(await request.json());
  if (parsed.paymentStatus !== "COMPLETED") {
    return ok({ accepted: true, updated: false });
  }

  await BillingService.markPaidByReference(parsed.merchantReference, {
    orderTrackingId: parsed.orderTrackingId,
    paymentStatus: parsed.paymentStatus,
    payload: parsed.payload ?? null,
  });

  return ok({ accepted: true, updated: true });
});
