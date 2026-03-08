"use client";

import Link from "next/link";
import { useState } from "react";

export function StartOrganizationForm() {
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("Africa/Kampala");
  const [locale, setLocale] = useState("en-UG");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/public/register-organization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationName,
          organizationCode,
          adminName,
          adminEmail,
          adminPhone: adminPhone || undefined,
          password,
          timezone,
          locale,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not create organization");
      }

      setMessage(
        `Organization created successfully. Continue to sign in as ${payload.data.adminEmail}.`,
      );
      window.location.assign(`/sign-in?next=${encodeURIComponent("/dashboard")}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create organization",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full rounded-3xl border border-border bg-surface p-7 shadow-sm">
      <h2 className="text-2xl font-bold">Create your SACCO account</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Start a 30-day free trial. Set up your organization and first admin account.
      </p>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <input
          required
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Organization name"
        />
        <input
          required
          value={organizationCode}
          onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Organization code (e.g. EAGLE-SACCO)"
        />
        <input
          required
          value={adminName}
          onChange={(event) => setAdminName(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Admin full name"
        />
        <input
          type="email"
          required
          value={adminEmail}
          onChange={(event) => setAdminEmail(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Admin email"
        />
        <input
          value={adminPhone}
          onChange={(event) => setAdminPhone(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Admin phone (optional)"
        />
        <input
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Password (min 8 characters)"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Timezone"
          />
          <input
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Locale"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating organization..." : "Start free trial"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <p className="mt-4 text-sm text-muted-foreground">
        Already registered? <Link href="/sign-in" className="text-[#cc5500]">Sign in</Link>
      </p>
    </section>
  );
}
