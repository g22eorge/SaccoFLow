"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateMemberForm() {
  const router = useRouter();
  const [memberNumber, setMemberNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberNumber,
          fullName,
          phone: phone || undefined,
          email: email || undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to create member");
      }

      setMessage(`Created member: ${payload.data.fullName}`);
      setMemberNumber("");
      setFullName("");
      setPhone("");
      setEmail("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">Add Member</h2>
      <p className="text-sm text-muted-foreground">
        Register a member profile with optional contact details.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Member number</span>
          <input
            required
            value={memberNumber}
            onChange={(event) => setMemberNumber(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="M-0001"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Full name</span>
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Jane Doe"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Phone (optional)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="+256..."
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Email (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="member@sacco.org"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {loading ? "Saving..." : "Create Member"}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
