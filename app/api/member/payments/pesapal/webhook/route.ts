import { z } from "zod";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import { MemberPaymentsService } from "@/src/server/services/member-payments.service";

const webhookSchema = z.object({
  merchantReference: z.string().min(8),
  paymentStatus: z.enum(["COMPLETED", "FAILED", "PENDING"]),
  orderTrackingId: z.string().optional(),
  payload: z.unknown().optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const secret = process.env.PESAPAL_MEMBER_WEBHOOK_SECRET ?? process.env.PESAPAL_WEBHOOK_SECRET;
  if (secret) {
    const incoming = request.headers.get("x-pesapal-secret");
    if (incoming !== secret) {
      return fail("Invalid webhook signature", 401, "INVALID_SIGNATURE");
    }
  }

  const parsed = webhookSchema.parse(await request.json());
  const result = await MemberPaymentsService.reconcileWebhook({
    checkoutReference: parsed.merchantReference,
    paymentStatus: parsed.paymentStatus,
    providerReference: parsed.orderTrackingId,
    payload: parsed.payload,
  });

  return ok(result);
});
