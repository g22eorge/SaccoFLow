"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/src/server/auth/auth-client";

function LandingAndSignIn() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result?.error) {
        setError(result.error.message ?? "Invalid email or password");
        return;
      }
      window.location.href = nextUrl;
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-2 lg:items-center">
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
          SACCOFlow
        </p>
        <h1 className="text-4xl font-bold leading-tight">
          Run your SACCO with role-based clarity for Chairperson, Treasurer, Board, and Members.
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          See executive signals, manage cash and lending operations, and keep
          every decision auditable from one secure workspace.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Executive View
            </p>
            <p className="mt-1 text-sm font-medium">
              Signals, scenarios, and board action tracking.
            </p>
          </article>
          <article className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Operations
            </p>
            <p className="mt-1 text-sm font-medium">
              Savings, shares, loans, cashflow, and compliance exports.
            </p>
          </article>
        </div>
      </section>

      <section className="w-full rounded-3xl border border-border bg-surface p-7 shadow-sm">
        <h2 className="text-2xl font-bold">Sign in</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your SACCO credentials to continue.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="you@sacco.org"
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
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
        <Link href="/reset-password" className="mt-4 inline-block text-sm text-accent">
          Forgot password?
        </Link>
      </section>
    </main>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LandingAndSignIn />
    </Suspense>
  );
}
