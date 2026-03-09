import { prisma } from "@/src/server/db/prisma";

export const IdempotencyService = {
  getKeyFromRequest(request: Request) {
    const key = request?.headers?.get?.("idempotency-key")?.trim();
    if (!key) {
      return null;
    }
    return key.slice(0, 120);
  },

  async run<T>(input: {
    saccoId: string;
    scope: string;
    key: string | null;
    execute: () => Promise<T>;
  }) {
    if (!input.key) {
      return { replayed: false, data: await input.execute() };
    }

    const existing = await prisma.apiIdempotencyKey.findUnique({
      where: {
        saccoId_scope_key: {
          saccoId: input.saccoId,
          scope: input.scope,
          key: input.key,
        },
      },
      select: { id: true, status: true, responseJson: true },
    });
    if (existing?.status === "SUCCESS" && existing.responseJson) {
      return {
        replayed: true,
        data: JSON.parse(existing.responseJson) as T,
      };
    }
    if (existing?.status === "PENDING") {
      throw new Error("Duplicate request already in progress");
    }

    const row =
      existing ??
      (await prisma.apiIdempotencyKey.create({
        data: {
          saccoId: input.saccoId,
          scope: input.scope,
          key: input.key,
          status: "PENDING",
        },
        select: { id: true },
      }));

    try {
      const data = await input.execute();
      await prisma.apiIdempotencyKey.update({
        where: { id: row.id },
        data: {
          status: "SUCCESS",
          responseJson: JSON.stringify(data),
        },
      });
      return { replayed: false, data };
    } catch (error) {
      await prisma.apiIdempotencyKey.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          responseJson: null,
        },
      });
      throw error;
    }
  },
};
