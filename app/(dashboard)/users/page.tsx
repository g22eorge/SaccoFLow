import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { SiteHeader } from "@/components/site-header";
import { UsersTable } from "@/src/ui/tables/users-table";
import { CreateUserDialogClient } from "@/src/ui/components/create-user-dialog-client";
import {
  ASSIGNABLE_ROLES_BY_ACTOR,
  ROLE_DESCRIPTIONS,
  ROLE_LEVELS,
  type SaccoRole,
} from "@/src/lib/roles";

export default async function UsersPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(role)) {
    redirect("/dashboard");
  }

  const allowedRoles =
    ((ASSIGNABLE_ROLES_BY_ACTOR as Record<string, readonly string[]>)[role] ?? []).filter(
      (value): value is SaccoRole => value in ROLE_LEVELS,
    );
  const manageableRoles: SaccoRole[] = allowedRoles;

  const users = await UsersService.list({ saccoId, page: 1 });

  return (
    <>
      <SiteHeader title="Users" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                        Access Control
                      </p>
                      <h1 className="mt-2 text-2xl font-bold">Users</h1>
                      <p className="mt-2 text-muted-foreground">
                        Create and manage SACCO users with role-based access.
                      </p>
                    </div>
                    <CreateUserDialogClient allowedRoles={allowedRoles} />
                  </div>
                </div>

                <UsersTable
                  users={users}
                  assignableRoles={allowedRoles}
                  manageableRoles={manageableRoles}
                />

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Role Levels</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Level 1 is highest authority. Treasurer, Loan Officer, and Auditor are peer specialists at Level 3.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {(["TREASURER", "LOAN_OFFICER", "AUDITOR"] as const).map((roleKey) => (
                      <article key={roleKey} className="rounded-md border bg-background px-4 py-3">
                        <p className="text-sm font-semibold">{roleKey}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Level {ROLE_LEVELS[roleKey]}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[roleKey]}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
