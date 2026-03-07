import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/server/auth/auth";
import {
  TWO_FACTOR_SESSION_COOKIE,
  getSessionTokenFromRequestCookies,
} from "@/src/lib/auth-2fa";
import { fail, ok, withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  const diagnosticsEnabled =
    process.env.NODE_ENV !== "production" || process.env.AUTH_DIAGNOSTICS === "true";

  if (!diagnosticsEnabled) {
    return fail("Not found", 404, "NOT_FOUND");
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const sessionToken = getSessionTokenFromRequestCookies(request.cookies);
  const twoFactorCookie = request.cookies.get(TWO_FACTOR_SESSION_COOKIE)?.value ?? null;

  return ok({
    hasSessionTokenCookie: Boolean(sessionToken),
    hasTwoFactorCookie: Boolean(twoFactorCookie),
    sessionUserId: session?.user?.id ?? null,
    sessionEmail: session?.user?.email ?? null,
    twoFactorMatchesUserId:
      Boolean(twoFactorCookie) && Boolean(session?.user?.id)
        ? twoFactorCookie === (session?.user?.id ?? null)
        : null,
    cookieNames: request.cookies.getAll().map((cookie) => cookie.name),
  });
});
