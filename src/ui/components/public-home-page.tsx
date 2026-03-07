"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/src/server/auth/auth-client";

export function PublicHomeClient({ nextUrl }: { nextUrl: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"CREDENTIALS" | "OTP">("CREDENTIALS");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [twoFactorHint, setTwoFactorHint] = useState<string | null>(null);
  const [twoFactorChannel, setTwoFactorChannel] = useState<string | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startTwoFactor = async (preferredChannel: "EMAIL" | "SMS") => {
    const twoFactorStart = await fetch("/api/auth/2fa/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferredChannel }),
    });
    const twoFactorPayload = await twoFactorStart.json();
    if (!twoFactorStart.ok || !twoFactorPayload.success) {
      throw new Error(
        twoFactorPayload.error?.message ?? "Could not start two-factor verification",
      );
    }

    setStep("OTP");
    setOtpCode("");
    setDemoCode(
      typeof twoFactorPayload?.data?.otpPreview === "string"
        ? twoFactorPayload.data.otpPreview
        : null,
    );
    setTwoFactorHint(twoFactorPayload?.data?.destinationHint ?? null);
    setTwoFactorChannel(twoFactorPayload?.data?.channel ?? null);
    setMessage(
      `Verification code sent via ${String(twoFactorPayload?.data?.channel ?? "EMAIL").toLowerCase()} to ${twoFactorPayload?.data?.destinationHint ?? "your account"}.`,
    );
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      let email = identifier.trim().toLowerCase();
      if (!email.includes("@")) {
        const resolveResponse = await fetch("/api/auth/resolve-identifier", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const resolvePayload = await resolveResponse.json();
        email = resolvePayload?.data?.email ?? "";
      }

      if (!email) {
        setError("Invalid credentials");
        return;
      }

      setResolvedEmail(email);

      const signInResponse = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: true }),
      });
      const signInPayload = await signInResponse.json().catch(() => null);
      if (!signInResponse.ok) {
        setError(
          signInPayload?.message ??
            signInPayload?.error?.message ??
            "Invalid email or password",
        );
        return;
      }

      await startTwoFactor(identifier.trim().includes("@") ? "EMAIL" : "SMS");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
      await authClient.signOut();
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Invalid verification code");
      }

      let sessionReady = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const sessionResponse = await fetch("/api/auth/get-session", {
          credentials: "include",
          cache: "no-store",
        });
        const sessionPayload = await sessionResponse.json().catch(() => null);
        if (sessionResponse.ok && sessionPayload?.user) {
          sessionReady = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!sessionReady) {
        try {
          const diagnostics = await fetch("/api/auth/diagnostics/session", {
            credentials: "include",
            cache: "no-store",
          });
          const diagnosticsPayload = await diagnostics.json().catch(() => null);
          console.error("[AUTH_DIAGNOSTICS] Session not ready after verify", diagnosticsPayload);
        } catch (diagnosticsError) {
          console.error("[AUTH_DIAGNOSTICS] Failed to collect diagnostics", diagnosticsError);
        }
        throw new Error("Session setup delayed. Please click Verify and continue again.");
      }

      window.location.replace(nextUrl);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      await startTwoFactor(identifier.trim().includes("@") ? "EMAIL" : "SMS");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  const useDifferentAccount = async () => {
    await fetch("/api/auth/2fa/clear", { method: "POST", credentials: "include" });
    await authClient.signOut();
    setStep("CREDENTIALS");
    setPassword("");
    setOtpCode("");
    setResolvedEmail(null);
    setTwoFactorHint(null);
    setTwoFactorChannel(null);
    setDemoCode(null);
    setMessage(null);
    setError(null);
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-2 lg:items-center">
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">SACCOFlow</p>
        <h1 className="text-4xl font-bold leading-tight">
          Run your SACCO with role-based clarity for Chairperson, Treasurer, Board, and Members.
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          See executive signals, manage cash and lending operations, and keep every decision auditable
          from one secure workspace.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Executive View</p>
            <p className="mt-1 text-sm font-medium">Signals, scenarios, and board action tracking.</p>
          </article>
          <article className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Operations</p>
            <p className="mt-1 text-sm font-medium">Savings, shares, loans, cashflow, and compliance exports.</p>
          </article>
        </div>
      </section>

      <section className="w-full rounded-3xl border border-border bg-surface p-7 shadow-sm">
        <h2 className="text-2xl font-bold">{step === "CREDENTIALS" ? "Sign in" : "Security Check"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "CREDENTIALS"
            ? "Use your SACCO credentials to continue."
            : "Enter the 6-digit verification code to continue."}
        </p>
        {step === "CREDENTIALS" ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="identifier">
                Email or phone number
              </label>
              <input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="you@sacco.org or +2567xxxxxxx"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="********"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onVerify}>
            <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              {resolvedEmail ? `Signed in as ${resolvedEmail}. ` : ""}
              Code channel: {String(twoFactorChannel ?? "EMAIL").toLowerCase()}
              {twoFactorHint ? ` to ${twoFactorHint}` : ""}.
            </div>
            {typeof demoCode === "string" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Demo code for this environment: <span className="font-semibold">{demoCode}</span>
              </p>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="otp-code">
                Verification code
              </label>
              <input
                id="otp-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="123456"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and continue"}
            </button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className="text-sm text-accent disabled:opacity-60"
              >
                {resending ? "Sending..." : "Resend code"}
              </button>
              <button type="button" onClick={useDifferentAccount} className="text-sm text-muted-foreground">
                Use different account
              </button>
            </div>
          </form>
        )}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {step === "CREDENTIALS" ? (
          <Link href="/reset-password" className="mt-4 inline-block text-sm text-accent">
            Forgot password?
          </Link>
        ) : null}
      </section>
    </main>
  );
}
