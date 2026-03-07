import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/prisma";
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  TWO_FACTOR_PENDING_COOKIE,
  TWO_FACTOR_SESSION_COOKIE,
  getSessionTokenFromRequestCookies,
  hashOtpCode,
} from "@/src/lib/auth-2fa";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import { UnauthorizedError } from "@/src/server/auth/rbac";
import { shouldUseSecureCookies } from "@/src/lib/cookie-security";

const verifyTwoFactorSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

type DbChallenge = {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
};

type LoginChallengeDelegate = {
  findFirst: (input: {
    where: { userId: string; consumedAt: null };
    orderBy: { createdAt: "desc" };
  }) => Promise<DbChallenge | null>;
  update: (input: {
    where: { id: string };
    data: { attempts: { increment: number } } | { consumedAt: Date };
  }) => Promise<unknown>;
};

const isMissingLoginChallengeTable = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("LoginChallenge") ||
    error.message.includes("does not exist in the current database"));

export const POST = withApiHandler(async (request: NextRequest) => {
  const parsed = verifyTwoFactorSchema.parse(await request.json());
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new UnauthorizedError("Missing authenticated user");
  }

  const sessionToken = getSessionTokenFromRequestCookies(request.cookies);
  if (!sessionToken) {
    throw new UnauthorizedError("Missing active session token");
  }

  const submittedCodeHash = await hashOtpCode(parsed.code);
  const secureCookies = shouldUseSecureCookies(request);
  const loginChallenge = (prisma as unknown as { loginChallenge?: LoginChallengeDelegate })
    .loginChallenge;

  let cookieFallback: {
    codeHash: string;
    expiresAtIso: string;
    attempts: number;
    maxAttempts: number;
  } | null = null;

  const loadCookieFallback = () => {
    const raw = request.cookies.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as {
        codeHash: string;
        expiresAtIso: string;
        attempts: number;
        maxAttempts: number;
      };
    } catch {
      return null;
    }
  };

  let canUseDbChallenge = Boolean(loginChallenge);

  if (canUseDbChallenge && loginChallenge) {
    try {
      const challenge = await loginChallenge.findFirst({
        where: { userId: session.user.id, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });

      if (!challenge) {
        throw new Error("No pending verification code. Request a new code.");
      }

      if (challenge.expiresAt.getTime() < Date.now()) {
        throw new Error("Verification code expired. Request a new code.");
      }

      if (challenge.attempts >= challenge.maxAttempts) {
        throw new Error("Too many failed attempts. Request a new code.");
      }

      if (challenge.codeHash !== submittedCodeHash) {
        await loginChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });

        const failed = fail("Invalid verification code", 400, "INVALID_OTP");
        failed.cookies.delete(TWO_FACTOR_SESSION_COOKIE);
        failed.cookies.set(TWO_FACTOR_PENDING_COOKIE, "1", {
          httpOnly: true,
          sameSite: "lax",
          secure: secureCookies,
          path: "/",
          maxAge: 300,
        });
        return failed;
      }

      await loginChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
    } catch (error) {
      if (!isMissingLoginChallengeTable(error)) {
        throw error;
      }
      canUseDbChallenge = false;
    }
  }

  if (!canUseDbChallenge) {
    cookieFallback = loadCookieFallback();
    const challenge = cookieFallback;

    if (!challenge) {
      throw new Error("No pending verification code. Request a new code.");
    }

    if (new Date(challenge.expiresAtIso).getTime() < Date.now()) {
      throw new Error("Verification code expired. Request a new code.");
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new Error("Too many failed attempts. Request a new code.");
    }

    if (challenge.codeHash !== submittedCodeHash) {
      const failed = fail("Invalid verification code", 400, "INVALID_OTP");
      failed.cookies.set(
        TWO_FACTOR_CHALLENGE_COOKIE,
        JSON.stringify({
          codeHash: challenge.codeHash,
          expiresAtIso: challenge.expiresAtIso,
          attempts: challenge.attempts + 1,
          maxAttempts: challenge.maxAttempts,
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: secureCookies,
          path: "/",
          maxAge: 300,
        },
      );
      failed.cookies.delete(TWO_FACTOR_SESSION_COOKIE);
      failed.cookies.set(TWO_FACTOR_PENDING_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
        path: "/",
        maxAge: 300,
      });
      return failed;
    }
  }

  const response = ok({ verified: true });
  response.cookies.set(TWO_FACTOR_SESSION_COOKIE, session.user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  response.cookies.delete(TWO_FACTOR_PENDING_COOKIE);
  response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
  return response;
});
