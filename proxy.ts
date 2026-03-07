import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  TWO_FACTOR_SESSION_COOKIE,
  getSessionTokenFromRequestCookies,
} from "@/src/lib/auth-2fa";

const protectedPrefixes = [
  "/dashboard",
  "/users",
  "/members",
  "/savings",
  "/loans",
  "/reports",
  "/platform",
];

const requireStrictTwoFactor =
  process.env.NODE_ENV === "production" &&
  process.env.DEMO_OTP_PREVIEW !== "true";

export function proxy(request: NextRequest) {
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionToken = getSessionTokenFromRequestCookies(request.cookies);
  if (!requireStrictTwoFactor) {
    if (sessionToken) {
      return NextResponse.next();
    }

    const signInUrl = new URL("/", request.url);
    signInUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signInUrl);
  }

  const secondFactorSession = request.cookies.get(TWO_FACTOR_SESSION_COOKIE)?.value;
  if (sessionToken && secondFactorSession) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/", request.url);
  signInUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/members/:path*",
    "/savings/:path*",
    "/loans/:path*",
    "/reports/:path*",
    "/platform/:path*",
  ],
};
