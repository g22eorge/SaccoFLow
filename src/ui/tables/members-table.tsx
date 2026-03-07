"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/src/lib/money";
import { formatMemberLabel } from "@/src/lib/member-label";

type MemberRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  savingsBalance?: string;
};

const memberStatusChipClass = (status: string) => {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "INACTIVE") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
  return "border-orange-200 bg-orange-50 text-[#cc5500]";
};

export function MembersTable({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "savings">("name");

  const toNumber = (value?: string) =>
    value ? Number(value.replace(/[^0-9.-]/g, "")) : 0;

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = members.filter((member) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : member.status === statusFilter;
      const haystack = [
        member.memberNumber,
        member.fullName,
        member.phone ?? "",
        member.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery
        ? haystack.includes(normalizedQuery)
        : true;
      return matchesStatus && matchesQuery;
    });

    if (sortBy === "savings") {
      return [...filtered].sort(
        (a, b) => toNumber(b.savingsBalance) - toNumber(a.savingsBalance),
      );
    }
    return [...filtered].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, query, sortBy, statusFilter]);

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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            Search, filter, and edit member profiles.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search member"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "name" | "savings")
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="name">Sort: Name</option>
            <option value="savings">Sort: Savings</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Member #</th>
              <th className="min-w-[25ch] px-3 py-2">Full Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Savings</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member) => {
              const isEditing = editingId === member.id;
              const isBusy = loadingId === member.id;
              return (
                <tr key={member.id} className="border-t align-top hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs font-semibold">{member.memberNumber}</td>
                  <td className="min-w-[25ch] px-3 py-2 text-xs">
                    {isEditing ? (
                      <input
                        value={draft.fullName}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, fullName: event.target.value }))
                        }
                        className="min-w-[25ch] w-full rounded border border-border bg-background px-2 py-1"
                      />
                    ) : (
                      formatMemberLabel(member.memberNumber, member.fullName)
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {isEditing ? (
                      <input
                        value={draft.phone}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, phone: event.target.value }))
                        }
                        className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                      />
                    ) : (
                      member.phone ?? "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {isEditing ? (
                      <input
                        value={draft.email}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, email: event.target.value }))
                        }
                        className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                      />
                    ) : (
                      member.email ?? "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {isEditing ? (
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, status: event.target.value }))
                        }
                        className="rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    ) : (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${memberStatusChipClass(member.status)}`}>
                        {member.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold">
                    {member.savingsBalance ? formatMoney(member.savingsBalance) : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex flex-wrap gap-2">
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
                          <Link href={`/dashboard/members/${member.id}`} className="rounded-lg border border-border px-2 py-1">
                            Snapshot
                          </Link>
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleMembers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No members match this filter.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
