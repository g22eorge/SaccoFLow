"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { ROLE_LEVELS, type SaccoRole } from "@/src/lib/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type UserRow = {
  id: string
  email: string
  fullName: string | null
  role: string
  isActive: boolean
  createdAt: Date
}

export function UsersTable({
  users,
  assignableRoles,
  manageableRoles,
}: {
  users: UserRow[];
  assignableRoles: SaccoRole[];
  manageableRoles: SaccoRole[];
}) {
  const router = useRouter();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<"password" | "role" | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, SaccoRole>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callUpdate = async (
    userId: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? "Failed to update user");
      }

      setMessage(successMessage);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to update user",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (userId: string) => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: passwordInput || undefined,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: { email: string; temporaryPassword: string };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed to reset password");
      }

      setMessage(
        `Password updated for ${payload.data.email}. Temporary password: ${payload.data.temporaryPassword}`,
      );
      setActiveUserId(null);
      setActiveEditor(null);
      setPasswordInput("");
      router.refresh();
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset password",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const revokeSessions = async (userId: string) => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/sessions`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        success: boolean;
        data?: { email: string; revokedSessions: number };
        error?: { message?: string };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? "Failed to revoke sessions");
      }

      setMessage(
        `Revoked ${result.data.revokedSessions} active sessions for ${result.data.email}.`,
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to revoke sessions",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">Users</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>{user.fullName ?? "-"}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {user.role} {user.role in ROLE_LEVELS ? `| L${ROLE_LEVELS[user.role as SaccoRole]}` : ""}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTimeUtc(user.createdAt)}
              </TableCell>
              <TableCell>
                {manageableRoles.includes(user.role as SaccoRole) ? (
                  <div className="space-y-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          id={`user-actions-${user.id}`}
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          Actions
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-lg">
                        <DropdownMenuItem
                          onSelect={() => {
                            setActiveUserId(user.id);
                            setActiveEditor("role");
                            setMessage(null);
                            setError(null);
                          }}
                        >
                          Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setActiveUserId(user.id);
                            setActiveEditor("password");
                            setPasswordInput("");
                            setMessage(null);
                            setError(null);
                          }}
                        >
                          Change Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            callUpdate(
                              user.id,
                              { isActive: !user.isActive },
                              `${user.isActive ? "Deactivated" : "Activated"} ${user.email}.`,
                            )
                          }
                          disabled={submitting}
                        >
                          {user.isActive ? "Deactivate User" : "Activate User"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => revokeSessions(user.id)}
                          disabled={submitting}
                        >
                          Terminate Sessions
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {activeUserId === user.id && activeEditor === "role" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                           value={(roleDrafts[user.id] ?? user.role) as SaccoRole}
                           onChange={(event) =>
                             setRoleDrafts((prev) => ({
                               ...prev,
                               [user.id]: event.target.value as SaccoRole,
                             }))
                           }
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          {assignableRoles.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            callUpdate(
                              user.id,
                              {
                                role: roleDrafts[user.id] ?? user.role,
                              },
                              `Updated role for ${user.email}.`,
                            )
                          }
                          disabled={submitting}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          Save Role
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveUserId(null);
                            setActiveEditor(null);
                          }}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}

                    {activeUserId === user.id && activeEditor === "password" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="password"
                          value={passwordInput}
                          onChange={(event) => setPasswordInput(event.target.value)}
                          placeholder="New password (optional)"
                          className="w-52 rounded-md border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => resetPassword(user.id)}
                          disabled={submitting}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          {submitting ? "Saving..." : "Save Password"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveUserId(null);
                            setActiveEditor(null);
                            setPasswordInput("");
                          }}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No privileges</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No users found.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
