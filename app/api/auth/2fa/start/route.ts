import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/prisma";
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  TWO_FACTOR_PENDING_COOKIE,
  TWO_FACTOR_SESSION_COOKIE,
  generateOtpCode,
  getSessionTokenFromRequestCookies,
  hashOtpCode,
  maskEmail,
  maskPhone,
} from "@/src/lib/auth-2fa";
import { ok, withApiHandler } from "@/src/server/api/http";
import { UnauthorizedError } from "@/src/server/auth/rbac";
import { OtpDeliveryService } from "@/src/server/services/otp-delivery.service";
import { shouldUseSecureCookies } from "@/src/lib/cookie-security";

const startTwoFactorSchema = z
  .object({
    preferredChannel: z.enum(["EMAIL", "SMS"]).optional(),
  })
  .optional();

type LoginChallengeDelegate = {
  updateMany: (input: {
    where: { userId: string; consumedAt: null };
    data: { consumedAt: Date };
  }) => Promise<unknown>;
  create: (input: {
    data: {
      userId: string;
      channel: "EMAIL" | "SMS";
      destination: string;
      codeHash: string;
      expiresAt: Date;
      attempts: number;
      maxAttempts: number;
    };
  }) => Promise<unknown>;
};

const isMissingLoginChallengeTable = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("LoginChallenge") ||
    error.message.includes("does not exist in the current database"));

export const POST = withApiHandler(async (request: NextRequest) => {
  const parsed = startTwoFactorSchema.parse(await request.json().catch(() => ({})));
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id || !session.user.email) {
    throw new UnauthorizedError("Missing authenticated user");
  }

  const sessionToken = getSessionTokenFromRequestCookies(request.cookies);
  if (!sessionToken) {
    throw new UnauthorizedError("Missing active session token");
  }

  const appUser = await prisma.appUser.findFirst({
    where: { email: session.user.email.toLowerCase(), isActive: true },
    select: { email: true, phone: true },
  });

  if (!appUser) {
    throw new UnauthorizedError("Missing active SACCO profile");
  }

  const canUseSms = parsed?.preferredChannel === "SMS" && appUser.phone && OtpDeliveryService.hasSmsConfig();
  const channel = canUseSms ? "SMS" : "EMAIL";
  const destination = channel === "SMS" ? appUser.phone : appUser.email;
  if (!destination) {
    throw new Error("No destination available for two-factor code");
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const showOtpPreview =
    process.env.DEMO_OTP_PREVIEW === "true" && process.env.NODE_ENV !== "production";
  const loginChallenge = (prisma as unknown as { loginChallenge?: LoginChallengeDelegate })
    .loginChallenge;

  let persistedInDb = false;
  if (loginChallenge) {
    try {
      await loginChallenge.updateMany({
        where: { userId: session.user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      await loginChallenge.create({
        data: {
          userId: session.user.id,
          channel,
          destination,
          codeHash,
          expiresAt,
          attempts: 0,
          maxAttempts: 5,
        },
      });
      persistedInDb = true;
    } catch (error) {
      if (!isMissingLoginChallengeTable(error)) {
        throw error;
      }
    }
  }

  await OtpDeliveryService.sendCode({ channel, destination, code });

  const response = ok({
    channel,
    destinationHint: channel === "SMS" ? maskPhone(destination) : maskEmail(destination),
    expiresInSeconds: 300,
    ...(showOtpPreview ? { otpPreview: code } : {}),
  });
  const secureCookies = shouldUseSecureCookies(request);
  response.cookies.set(TWO_FACTOR_PENDING_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 300,
  });
  if (!persistedInDb) {
    response.cookies.set(
      TWO_FACTOR_CHALLENGE_COOKIE,
      JSON.stringify({ codeHash, expiresAtIso: expiresAt.toISOString(), attempts: 0, maxAttempts: 5 }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: secureCookies,
          path: "/",
          maxAge: 300,
        },
    );
  }
  response.cookies.delete(TWO_FACTOR_SESSION_COOKIE);
  return response;
});
