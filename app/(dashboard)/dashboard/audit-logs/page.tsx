import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { ReportsService } from "@/src/server/services/reports.service";

const VIEW_ROLES = [
  "SACCO_ADMIN",
  "SUPER_ADMIN",
  "TREASURER",
  "AUDITOR",
  "LOAN_OFFICER",
];

export default async function AuditLogsPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const auditLogs = await ReportsService.auditTrail({ saccoId, page: 1 });

  return (
    <>
      <SiteHeader title="Audit Logs" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Compliance
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Audit Logs</h1>
                  <p className="mt-2 text-muted-foreground">
                    Review recent system actions across members, loans, savings, and settings.
                  </p>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {auditLogs.map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-lg border bg-background p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
                            {entry.action}
                          </span>
                          <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
                            {entry.entity}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">
                          Actor: {entry.actor?.fullName ?? entry.actor?.email ?? "System"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Entity ID: {entry.entityId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </article>
                    ))}
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No audit logs recorded yet.
                      </p>
                    ) : null}
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
