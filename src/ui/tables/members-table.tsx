"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";

type MemberRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  savingsBalance?: string;
};

export function MembersTable({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<{
    fullName: string;
    phone: string;
    email: string;
    status: string;
  }>({
    fullName: "",
    phone: "",
    email: "",
    status: "ACTIVE",
  });

  const startEdit = (member: MemberRow) => {
    setEditingId(member.id);
    setDraft({
      fullName: member.fullName,
      phone: member.phone ?? "",
      email: member.email ?? "",
      status: member.status,
    });
  };

  const saveEdit = async (memberId: string) => {
    setLoadingId(memberId);
    setError(null);
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: draft.fullName,
          phone: draft.phone || undefined,
          email: draft.email || undefined,
          status: draft.status,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to update member");
      }

      setEditingId(null);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected error",
      );
    } finally {
      setLoadingId(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!window.confirm("Delete this member?")) {
      return;
    }

    setLoadingId(memberId);
    setError(null);
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to delete member");
      }

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected error",
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">Members</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => {
          const isEditing = editingId === member.id;
          const isBusy = loadingId === member.id;
          return (
            <article
              key={member.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {member.memberNumber}
                  </p>
                  {isEditing ? (
                    <input
                      value={draft.fullName}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          fullName: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded border border-border bg-background px-2 py-1"
                    />
                  ) : (
                    <p className="mt-1 font-semibold">{member.fullName}</p>
                  )}
                </div>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {isEditing ? draft.status : member.status}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-600">
                <p>
                  Phone:{" "}
                  {isEditing ? (
                    <input
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                    />
                  ) : (
                    <span className="text-foreground">
                      {member.phone ?? "-"}
                    </span>
                  )}
                </p>
                <p>
                  Email:{" "}
                  {isEditing ? (
                    <input
                      value={draft.email}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                    />
                  ) : (
                    <span className="text-foreground">
                      {member.email ?? "-"}
                    </span>
                  )}
                </p>
                <p>
                  Savings:{" "}
                  <span className="font-semibold text-foreground">
                    {member.savingsBalance
                      ? formatMoney(member.savingsBalance)
                      : "-"}
                  </span>
                </p>
              </div>

              {isEditing ? (
                <div className="mt-3">
                  <label className="space-y-1 text-xs text-slate-600">
                    <span className="block">Status</span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => saveEdit(member.id)}
                      disabled={isBusy}
                      className="rounded-lg bg-accent px-2 py-1 text-white hover:bg-accent-strong disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-border px-2 py-1"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(member)}
                      className="rounded-lg border border-border px-2 py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      disabled={isBusy}
                      className="rounded-lg border border-red-300 px-2 py-1 text-red-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
