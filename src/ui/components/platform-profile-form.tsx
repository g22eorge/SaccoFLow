"use client";

import { useState } from "react";

export function PlatformProfileForm({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const [name, setName] = useState(fullName);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/platform/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: name }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to update profile name");
      }
      setMessage("Profile name updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update profile name");
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/platform/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to update password");
      }
      setPassword("");
      setMessage("Password updated successfully.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Profile Management</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Maintain your technical superadmin profile and credentials.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-md border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="mt-1 text-sm font-medium">{email}</p>
        </article>
      </div>

      <form className="mt-4 space-y-3" onSubmit={updateName}>
        <label className="block text-sm font-medium" htmlFor="platform-full-name">
          Display name
        </label>
        <input
          id="platform-full-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          minLength={2}
          maxLength={120}
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>

      <form className="mt-6 space-y-3" onSubmit={updatePassword}>
        <label className="block text-sm font-medium" htmlFor="platform-password">
          New password
        </label>
        <input
          id="platform-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          minLength={8}
          maxLength={128}
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          {saving ? "Saving..." : "Update password"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
