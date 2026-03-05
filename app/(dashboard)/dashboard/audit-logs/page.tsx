import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { ReportsService } from "@/src/server/services/reports.service";
import { AuditLogsPanel } from "@/src/ui/components/audit-logs-panel";
import Link from "next/link";

const VIEW_ROLES = [
  "SACCO_ADMIN",
  "SUPER_ADMIN",
  "CHAIRPERSON",
  "BOARD_MEMBER",
  "TREASURER",
  "AUDITOR",
  "LOAN_OFFICER",
];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const { saccoId, role } = await requireSaccoContext();
  if (!VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const auditLogs = await ReportsService.auditTrail({ saccoId, page });
  const hasNextPage = auditLogs.length === 30;
  const auditRows = auditLogs.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    createdAt: entry.createdAt.toISOString(),
    actorName: entry.actor?.fullName ?? entry.actor?.email ?? "System",
  }));

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
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {new Date().toLocaleString()} | Page {page}
                  </p>
                </div>

                <AuditLogsPanel logs={auditRows} />

                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={page > 1 ? `/dashboard/audit-logs?page=${page - 1}` : "#"}
                      className={`text-sm ${page > 1 ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Previous
                    </Link>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Link
                      href={hasNextPage ? `/dashboard/audit-logs?page=${page + 1}` : "#"}
                      className={`text-sm ${hasNextPage ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Next
                    </Link>
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
