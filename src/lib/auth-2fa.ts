export const TWO_FACTOR_SESSION_COOKIE = "sacco_2fa_session";
export const TWO_FACTOR_PENDING_COOKIE = "sacco_2fa_pending";
export const TWO_FACTOR_CHALLENGE_COOKIE = "sacco_2fa_challenge";

export const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");

export const hashOtpCode = async (code: string) => {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const generateOtpCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "***";
  }

  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

export const maskPhone = (phone: string) => {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) {
    return `***${normalized}`;
  }
  return `${"*".repeat(Math.max(normalized.length - 4, 3))}${normalized.slice(-4)}`;
};

export const getSessionTokenFromRequestCookies = (cookies: {
  get: (name: string) => { value: string } | undefined;
  getAll?: () => Array<{ name: string; value: string }>;
}) =>
  cookies.get("better-auth.session_token")?.value ??
  cookies.get("__Secure-better-auth.session_token")?.value ??
  cookies
    .getAll?.()
    .find(
      (cookie) =>
        cookie.name.startsWith("better-auth.session_token") ||
        cookie.name.startsWith("__Secure-better-auth.session_token"),
    )
    ?.value ??
  null;
