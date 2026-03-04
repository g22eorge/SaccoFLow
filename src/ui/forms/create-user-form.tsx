"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const roleOptions = [
  "SACCO_ADMIN",
  "TREASURER",
  "LOAN_OFFICER",
  "AUDITOR",
  "MEMBER",
] as const;

type Role = (typeof roleOptions)[number];

export function CreateUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          fullName: fullName || undefined,
          role,
          password: password || undefined,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        data?: { email: string; generatedPassword?: string };
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "Failed to create user");
      }

      const generatedPassword = result.data?.generatedPassword;
      setMessage(
        generatedPassword
          ? `Created user: ${result.data?.email ?? email}. Temporary password: ${generatedPassword}`
          : `Created user: ${result.data?.email ?? email}`,
      );
      setEmail("");
      setFullName("");
      setRole("MEMBER");
      setPassword("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create user",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">Create User</h2>
      <p className="text-sm text-slate-600">
        Provision user access and assign a role for SACCO operations.
      </p>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="role" className="mb-1 block text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Initial Password (optional)
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Auto-generate if blank"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create User"}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
