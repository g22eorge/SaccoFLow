import { createHash } from "node:crypto";
import { prisma } from "@/src/server/db/prisma";

export const WebhookEventService = {
  async claim(input: {
    saccoId: string;
    provider: string;
    eventKey: string;
    rawBody: string;
  }) {
    const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");

    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventKey: {
          provider: input.provider,
          eventKey: input.eventKey,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { replayed: true };
    }

    await prisma.webhookEvent.create({
      data: {
        saccoId: input.saccoId,
        provider: input.provider,
        eventKey: input.eventKey,
        payloadHash,
      },
    });
    return { replayed: false };
  },
};
