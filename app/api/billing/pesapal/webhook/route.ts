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
  const parsed = webhookSchema.parse(await request.json());
  const incomingSecret = request.headers.get("x-pesapal-secret");
  try {
    await BillingService.verifyWebhookSecretByReference(
      parsed.merchantReference,
      incomingSecret,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid webhook signature") {
      return fail("Invalid webhook signature", 401, "INVALID_SIGNATURE");
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
