import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";

export default async function AccountPage() {
  const { role, saccoId } = await requireSaccoContext();

  return (
    <>
      <SiteHeader title="Account" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Profile
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Account</h1>
                  <p className="mt-2 text-muted-foreground">
                    Your workspace identity and access context.
                  </p>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                      <p className="mt-1 text-xl font-semibold">{role}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">SACCO ID</p>
                      <p className="mt-1 break-all text-sm font-semibold">{saccoId}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick Actions</p>
                      <div className="mt-2 flex flex-col gap-1 text-sm">
                        <Link href="/dashboard/settings" className="text-[#cc5500]">Open settings</Link>
                        <Link href="/users" className="text-[#cc5500]">Manage users</Link>
                      </div>
                    </article>
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
