import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { prisma } from "@/src/server/db/prisma";
import { normalizePhone } from "@/src/lib/auth-2fa";

const resolveIdentifierSchema = z.object({
  identifier: z.string().min(3),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = resolveIdentifierSchema.parse(await request.json());
  const identifier = body.identifier.trim();

  if (identifier.includes("@")) {
    return ok({ email: identifier.toLowerCase() });
  }

  const normalized = normalizePhone(identifier);
  if (!normalized) {
    return ok({ email: null });
  }

  const candidates = await prisma.appUser.findMany({
    where: {
      isActive: true,
      phone: { not: null, endsWith: normalized.slice(-7) },
    },
    select: { email: true, phone: true },
    take: 25,
  });

  const matched = candidates.find(
    (candidate) =>
      typeof candidate.phone === "string" &&
      normalizePhone(candidate.phone) === normalized,
  );

  return ok({ email: matched?.email?.toLowerCase() ?? null });
});
