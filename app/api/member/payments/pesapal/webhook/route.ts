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
  const parsed = webhookSchema.parse(await request.json());
  const incomingSecret = request.headers.get("x-pesapal-secret");

  let result;
  try {
    result = await MemberPaymentsService.reconcileWebhook({
      checkoutReference: parsed.merchantReference,
      paymentStatus: parsed.paymentStatus,
      providerReference: parsed.orderTrackingId,
      payload: parsed.payload,
      providedSecret: incomingSecret,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid webhook signature") {
      return fail("Invalid webhook signature", 401, "INVALID_SIGNATURE");
    }
    throw error;
  }

  return ok(result);
});
