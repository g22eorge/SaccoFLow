type Check = {
  name: string;
  path: string;
  expected: number[];
};

type CheckResult = {
  run: number;
  name: string;
  path: string;
  status: number;
  durationMs: number;
  ok: boolean;
};

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const cookieFromEnv = process.env.SMOKE_COOKIE;
const identifier = process.env.SMOKE_IDENTIFIER;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const otpFromEnv = process.env.SMOKE_OTP_CODE;
const perfRuns = Number(process.env.SMOKE_PERF_RUNS ?? "1");
const args = new Set(process.argv.slice(2));
const outputJson = args.has("--json");

const jsonHeaders = { "content-type": "application/json" };
const baseOrigin = new URL(baseUrl).origin;

const cookieJar = new Map<string, string>();

const readSetCookies = (response: Response) => {
  const fromGetSetCookie = (response.headers as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (Array.isArray(fromGetSetCookie) && fromGetSetCookie.length > 0) {
    return fromGetSetCookie;
  }

  const fallback = response.headers.get("set-cookie");
  if (!fallback) {
    return [];
  }
  return [fallback];
};

const absorbCookies = (response: Response) => {
  const setCookies = readSetCookies(response);
  for (const line of setCookies) {
    const pair = line.split(";")[0];
    const [name, ...valueParts] = pair.split("=");
    if (!name || valueParts.length === 0) {
      continue;
    }
    cookieJar.set(name.trim(), valueParts.join("=").trim());
  }
};

const cookieHeader = () =>
  [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

const authFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      cookie: cookieHeader(),
      origin: baseOrigin,
      referer: `${baseOrigin}/`,
    },
    redirect: "manual",
  });
  absorbCookies(response);
  return response;
};

const ensureSignedIn = async () => {
  if (cookieFromEnv) {
    for (const part of cookieFromEnv.split(";")) {
      const [name, ...valueParts] = part.trim().split("=");
      if (!name || valueParts.length === 0) {
        continue;
      }
      cookieJar.set(name, valueParts.join("="));
    }
    return;
  }

  if (!password || (!identifier && !email)) {
    throw new Error(
      "Missing authentication for smoke checks. Set SMOKE_COOKIE, or SMOKE_PASSWORD plus SMOKE_IDENTIFIER/SMOKE_EMAIL.",
    );
  }

  let resolvedEmail = email;
  if (!resolvedEmail && identifier) {
    const resolve = await authFetch("/api/auth/resolve-identifier", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ identifier }),
    });

    const resolvePayload = (await resolve.json().catch(() => null)) as
      | { data?: { email?: string }; error?: { message?: string } }
      | null;

    if (!resolve.ok || !resolvePayload?.data?.email) {
      throw new Error(
        resolvePayload?.error?.message ?? `Identifier resolution failed with status ${resolve.status}`,
      );
    }
    resolvedEmail = resolvePayload.data.email;
  }

  if (!resolvedEmail) {
    throw new Error("Unable to resolve login email for smoke checks.");
  }

  const signIn = await authFetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: resolvedEmail, password, rememberMe: true }),
  });
  if (!signIn.ok) {
    throw new Error(`Sign-in failed with status ${signIn.status}`);
  }

  const start2fa = await authFetch("/api/auth/2fa/start", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ preferredChannel: "EMAIL" }),
  });

  const startPayload = (await start2fa.json().catch(() => null)) as
    | { data?: { otpPreview?: string }; error?: { message?: string } }
    | null;

  if (!start2fa.ok) {
    throw new Error(startPayload?.error?.message ?? `2FA start failed with status ${start2fa.status}`);
  }

  const otpCode = startPayload?.data?.otpPreview ?? otpFromEnv;
  if (!otpCode) {
    throw new Error(
      "2FA code is unavailable. Set SMOKE_OTP_CODE for non-demo environments, or use SMOKE_COOKIE.",
    );
  }

  const verify2fa = await authFetch("/api/auth/2fa/verify", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ code: otpCode }),
  });
  if (!verify2fa.ok) {
    throw new Error(`2FA verify failed with status ${verify2fa.status}`);
  }

  const session = await authFetch("/api/auth/get-session", { method: "GET" });
  const sessionPayload = (await session.json().catch(() => null)) as { user?: { id?: string } } | null;
  if (!session.ok || !sessionPayload?.user?.id) {
    throw new Error("Authenticated session not ready after 2FA verification.");
  }
};

const checks: Check[] = [
  { name: "Dashboard page", path: "/dashboard", expected: [200] },
  { name: "Members page", path: "/dashboard/members", expected: [200] },
  {
    name: "Members API date filter",
    path: "/api/members?page=1&from=2026-01-01&to=2026-12-31",
    expected: [200],
  },
  { name: "Savings page", path: "/dashboard/savings?from=2026-01-01&to=2026-12-31", expected: [200] },
  {
    name: "Savings API date filter",
    path: "/api/savings?page=1&from=2026-01-01&to=2026-12-31",
    expected: [200],
  },
  { name: "Shares page", path: "/dashboard/shares?from=2026-01-01&to=2026-12-31", expected: [200] },
  {
    name: "Shares API date filter",
    path: "/api/shares?page=1&from=2026-01-01&to=2026-12-31",
    expected: [200],
  },
  { name: "Loans page", path: "/dashboard/loans", expected: [200] },
  { name: "Reports page", path: "/dashboard/reports", expected: [200, 302] },
  { name: "Audit page", path: "/dashboard/audit-logs", expected: [200, 302] },
];

const run = async () => {
  const startedAtIso = new Date().toISOString();
  await ensureSignedIn();

  const runs = Number.isFinite(perfRuns) && perfRuns > 0 ? Math.floor(perfRuns) : 1;
  const results: CheckResult[] = [];

  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    if (runs > 1 && !outputJson) {
      console.log(`Run ${runIndex}/${runs}`);
    }

    for (const check of checks) {
      const startedAt = Date.now();
      const response = await authFetch(check.path, { method: "GET" });
      const durationMs = Date.now() - startedAt;
      const ok = check.expected.includes(response.status);

      if (!ok) {
        throw new Error(`${check.name} failed: got ${response.status} at ${check.path}`);
      }

      results.push({
        run: runIndex,
        name: check.name,
        path: check.path,
        status: response.status,
        durationMs,
        ok,
      });
      if (!outputJson) {
        console.log(`OK ${check.name}: ${response.status} (${durationMs}ms)`);
      }
    }
  }

  const allDurations = results.map((item) => item.durationMs);
  const avg = Math.round(allDurations.reduce((sum, value) => sum + value, 0) / allDurations.length);
  const slowest = results.reduce((max, item) => (item.durationMs > max.durationMs ? item : max), results[0]);
  const fastest = results.reduce((min, item) => (item.durationMs < min.durationMs ? item : min), results[0]);

  const endedAtIso = new Date().toISOString();
  const summary = {
    checks: results.length,
    avgMs: avg,
    fastest: {
      name: fastest.name,
      path: fastest.path,
      durationMs: fastest.durationMs,
    },
    slowest: {
      name: slowest.name,
      path: slowest.path,
      durationMs: slowest.durationMs,
    },
  };

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          startedAt: startedAtIso,
          endedAt: endedAtIso,
          baseUrl,
          runs,
          checkTemplates: checks,
          summary,
          results,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Performance summary: checks=${summary.checks}, avg=${summary.avgMs}ms, fastest=${summary.fastest.name} ${summary.fastest.durationMs}ms, slowest=${summary.slowest.name} ${summary.slowest.durationMs}ms`);
  console.log("Smoke checks passed.");
};

run().catch((error) => {
  console.error("Smoke checks failed:", error);
  process.exit(1);
});
