"use client";

import { Suspense, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

function VerifyTwoFactorContent() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";
  const debugCode = searchParams.get("code");

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(debugCode);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not verify code");
      }
      window.location.href = nextUrl;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/2fa/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not resend code");
      }
      if (typeof payload.data?.otpPreview === "string") {
        setDemoCode(payload.data.otpPreview);
      }
      setMessage(
        `Verification code sent via ${String(payload.data?.channel ?? "EMAIL").toLowerCase()} to ${payload.data?.destinationHint ?? "your account"}.${typeof payload.data?.otpPreview === "string" ? ` Demo code: ${payload.data.otpPreview}` : ""}`,
      );
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (debugCode) {
      return;
    }

    const sendInitialCode = async () => {
      setResending(true);
      setError(null);
      try {
        const response = await fetch("/api/auth/2fa/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "Could not send verification code");
        }
        if (typeof payload.data?.otpPreview === "string") {
          setDemoCode(payload.data.otpPreview);
        }
        setMessage(
          `Verification code sent via ${String(payload.data?.channel ?? "EMAIL").toLowerCase()} to ${payload.data?.destinationHint ?? "your account"}.${typeof payload.data?.otpPreview === "string" ? ` Demo code: ${payload.data.otpPreview}` : ""}`,
        );
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Could not send verification code");
      } finally {
        setResending(false);
      }
    };

    void sendInitialCode();
  }, [debugCode]);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-xl px-6 py-10">
      <section className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Security Check</p>
        <h1 className="mt-2 text-2xl font-bold">Two-factor verification</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit code sent to your registered email or phone.
        </p>
        {typeof demoCode === "string" ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo code for this environment: <span className="font-semibold">{demoCode}</span>
          </p>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={verify}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="123456"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify and continue"}
          </button>
        </form>
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="mt-3 text-sm text-accent disabled:opacity-60"
        >
          {resending ? "Sending new code..." : "Resend code"}
        </button>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  );
}

export default function VerifyTwoFactorPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <VerifyTwoFactorContent />
    </Suspense>
  );
}
