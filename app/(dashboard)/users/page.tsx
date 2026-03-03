import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { CreateUserForm } from "@/src/ui/forms/create-user-form";

export default async function UsersPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!["SACCO_ADMIN", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }
  const users = await UsersService.list({ saccoId, page: 1 });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Access Control
        </p>
        <h1 className="mt-2 text-2xl font-bold">Users</h1>
        <p className="mt-2 text-slate-600">
          Create and manage SACCO users with role-based access.
        </p>
      </div>

      <CreateUserForm />

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Existing Users</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <p className="font-semibold">{user.email}</p>
              <p className="mt-1 text-sm text-slate-600">
                Name: {user.fullName ?? "-"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {user.role}
                </span>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold">
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </article>
          ))}
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">No users found.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
