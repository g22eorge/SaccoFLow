import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { UsersService } from "@/src/server/services/users.service";
import { SiteHeader } from "@/components/site-header";
import { CreateUserDialog } from "@/src/ui/components/create-user-dialog";
import { UsersTable } from "@/src/ui/tables/users-table";

export default async function UsersPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!["SACCO_ADMIN", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }
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
                    <CreateUserDialog />
                  </div>
                </div>

                <UsersTable users={users} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
