import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  TWO_FACTOR_PENDING_COOKIE,
  TWO_FACTOR_SESSION_COOKIE,
} from "@/src/lib/auth-2fa";
import { ok, withApiHandler } from "@/src/server/api/http";

export const POST = withApiHandler(async () => {
  const response = ok({ cleared: true });
  response.cookies.delete(TWO_FACTOR_PENDING_COOKIE);
  response.cookies.delete(TWO_FACTOR_SESSION_COOKIE);
  response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
  return response;
});
