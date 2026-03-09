import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/src/server/api/http";

const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

const readTimestamp = (headers: Headers) =>
  headers.get("x-signature-timestamp") ?? headers.get("x-pesapal-timestamp");

const readSignature = (headers: Headers) =>
  headers.get("x-signature") ?? headers.get("x-pesapal-signature");

const safeEqual = (left: string, right: string) => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
};

export const verifyWebhookSignature = (input: {
  headers: Headers;
  rawBody: string;
  secret: string | null;
}) => {
  const { headers, rawBody, secret } = input;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "Webhook secret is not configured for this organization",
        500,
        "WEBHOOK_SECRET_NOT_CONFIGURED",
      );
    }
    return;
  }

  const timestamp = readTimestamp(headers);
  const signature = readSignature(headers);
  if (!timestamp || !signature) {
    throw new AppError("Missing webhook signature headers", 401, "INVALID_SIGNATURE");
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new AppError("Invalid signature timestamp", 401, "INVALID_SIGNATURE");
  }
  if (Math.abs(Date.now() - timestampMs) > SIGNATURE_WINDOW_MS) {
    throw new AppError("Expired webhook signature", 401, "INVALID_SIGNATURE");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  if (!safeEqual(signature, expected)) {
    throw new AppError("Invalid webhook signature", 401, "INVALID_SIGNATURE");
  }
};
