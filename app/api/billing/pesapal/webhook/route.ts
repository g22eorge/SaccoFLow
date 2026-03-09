import { z } from "zod";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import { BillingService } from "@/src/server/services/billing.service";
import { verifyWebhookSignature } from "@/src/server/security/webhook-signature";
import { WebhookEventService } from "@/src/server/services/webhook-event.service";

const webhookSchema = z.object({
  merchantReference: z.string().min(8),
  paymentStatus: z.enum(["COMPLETED", "FAILED", "PENDING"]),
  orderTrackingId: z.string().optional(),
  payload: z.unknown().optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const rawBody = await request.text();
  const parsed = webhookSchema.parse(JSON.parse(rawBody));
  let saccoId = "";
  try {
    const context = await BillingService.getWebhookContextByReference(parsed.merchantReference);
    saccoId = context.saccoId;
    verifyWebhookSignature({
      headers: request.headers,
      rawBody,
      secret: context.secret,
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

  const replay = await WebhookEventService.claim({
    saccoId,
    provider: "PESAPAL_BILLING",
    eventKey: `${parsed.merchantReference}:${parsed.orderTrackingId ?? "none"}:${parsed.paymentStatus}`,
    rawBody,
  });
  if (replay.replayed) {
    return ok({ accepted: true, updated: false, replayed: true });
  }

  if (parsed.paymentStatus !== "COMPLETED") {
    return ok({ accepted: true, updated: false, replayed: false });
  }

  await BillingService.markPaidByReference(parsed.merchantReference, {
    orderTrackingId: parsed.orderTrackingId,
    paymentStatus: parsed.paymentStatus,
    payload: parsed.payload ?? null,
  });

  return ok({ accepted: true, updated: true, replayed: false });
});
