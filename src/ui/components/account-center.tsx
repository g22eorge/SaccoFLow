"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeUtc } from "@/src/lib/datetime";

type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type ProfileData = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  jobTitle: string | null;
  branch: string | null;
  timezone: string | null;
  locale: string | null;
  avatarUrl: string | null;
  role: string;
  saccoId: string;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  notifyRepaymentReminderDays: number;
};

export function AccountCenter({
  profile,
  sessions,
  roleLevel,
  roleDescription,
  roleScope,
}: {
  profile: ProfileData;
  sessions: SessionRow[];
  roleLevel: string;
  roleDescription: string;
  roleScope: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "");
  const [timezone, setTimezone] = useState(profile.timezone ?? "Africa/Kampala");
  const [locale, setLocale] = useState(profile.locale ?? "en-UG");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [notifyEmail, setNotifyEmail] = useState(profile.notifyEmail);
  const [notifySms, setNotifySms] = useState(profile.notifySms);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(profile.notifyWhatsapp);
  const [notifyRepaymentReminderDays, setNotifyRepaymentReminderDays] = useState(
    profile.notifyRepaymentReminderDays,
  );
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          jobTitle,
          branch,
          timezone,
          locale,
          avatarUrl: avatarUrl || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to save profile");
      }
      setMessage("Profile essentials updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile");
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          notifyEmail,
          notifySms,
          notifyWhatsapp,
          notifyRepaymentReminderDays,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to save notification settings");
      }
      setMessage("Notification preferences updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save notifications");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to change password");
      }
      setNewPassword("");
      setMessage("Password changed. All sessions have been revoked; please sign in again.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Unable to change password");
    } finally {
      setLoading(false);
    }
  };

  const revokeSessions = async (sessionId?: string) => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sessionId ? { sessionId } : {}),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to terminate sessions");
      }
      setMessage(sessionId ? "Session terminated." : "All sessions terminated.");
      router.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to terminate sessions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Role & Scope Visibility</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
            <p className="mt-1 text-lg font-semibold">{profile.role}</p>
          </article>
          <article className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Role Level</p>
            <p className="mt-1 text-lg font-semibold">{roleLevel}</p>
          </article>
          <article className="rounded-md border bg-background px-4 py-3 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope</p>
            <p className="mt-1 text-sm font-medium">{roleScope}</p>
            <p className="mt-1 text-xs text-muted-foreground">{roleDescription}</p>
          </article>
        </div>
      </section>

      <form onSubmit={saveProfile} className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Profile Essentials</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Full name" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Phone" />
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Job title" />
          <input value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Branch" />
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Timezone" />
          <input value={locale} onChange={(e) => setLocale(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Locale" />
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm md:col-span-2" placeholder="Avatar URL" />
        </div>
        <button type="submit" disabled={loading} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </form>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Security Center</h2>
        <form onSubmit={changePassword} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="New password"
            minLength={8}
            required
          />
          <button type="submit" disabled={loading} className="rounded-lg border border-border px-3 py-2 text-sm">
            Update Password
          </button>
          <button type="button" onClick={() => revokeSessions()} disabled={loading} className="rounded-lg border border-border px-3 py-2 text-sm">
            Terminate All Sessions
          </button>
        </form>
        <div className="mt-4 space-y-2">
          {sessions.map((session) => (
            <article key={session.id} className="rounded-md border bg-background px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{session.userAgent ?? "Unknown device"}</p>
                <button
                  type="button"
                  onClick={() => revokeSessions(session.id)}
                  disabled={loading}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  End session
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Created: {formatDateTimeUtc(session.createdAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Expires: {formatDateTimeUtc(session.expiresAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">IP: {session.ipAddress ?? "-"}</p>
            </article>
          ))}
        </div>
      </section>

      <form onSubmit={saveNotifications} className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Email alerts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />
            SMS alerts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifyWhatsapp} onChange={(e) => setNotifyWhatsapp(e.target.checked)} />
            WhatsApp alerts
          </label>
          <label className="text-sm">
            Repayment reminder days before due
            <input
              type="number"
              min={0}
              max={30}
              value={notifyRepaymentReminderDays}
              onChange={(e) => setNotifyRepaymentReminderDays(Number(e.target.value || 0))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button type="submit" disabled={loading} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
          Save Preferences
        </button>
      </form>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
