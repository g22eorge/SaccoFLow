import { z } from "zod";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import { MemberPaymentsService } from "@/src/server/services/member-payments.service";
import { verifyWebhookSignature } from "@/src/server/security/webhook-signature";

const webhookSchema = z.object({
  merchantReference: z.string().min(8),
  paymentStatus: z.enum(["COMPLETED", "FAILED", "PENDING"]),
  orderTrackingId: z.string().optional(),
  payload: z.unknown().optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const rawBody = await request.text();
  const parsed = webhookSchema.parse(JSON.parse(rawBody));

  let result;
  try {
    const secret = await MemberPaymentsService.getWebhookSecretByReference(
      parsed.merchantReference,
    );
    verifyWebhookSignature({
      headers: request.headers,
      rawBody,
      secret,
    });
    result = await MemberPaymentsService.reconcileWebhook({
      checkoutReference: parsed.merchantReference,
      paymentStatus: parsed.paymentStatus,
      providerReference: parsed.orderTrackingId,
      payload: parsed.payload,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("signature") || error.message.includes("Webhook secret"))
    ) {
      return fail(error.message, 401, "INVALID_SIGNATURE");
    }
    throw error;
  }

  return ok(result);
});
