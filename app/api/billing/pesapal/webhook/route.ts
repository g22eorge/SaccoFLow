import { z } from "zod";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import { BillingService } from "@/src/server/services/billing.service";
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
  try {
    const secret = await BillingService.getWebhookSecretByReference(parsed.merchantReference);
    verifyWebhookSignature({
      headers: request.headers,
      rawBody,
      secret,
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
