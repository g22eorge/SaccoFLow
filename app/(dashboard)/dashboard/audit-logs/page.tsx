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

const ROLE_AUDIT_SCOPE: Partial<
  Record<
    (typeof VIEW_ROLES)[number],
    {
      entities?: string[];
      actions?: string[];
      canExport: boolean;
      label: string;
    }
  >
> = {
  SACCO_ADMIN: { canExport: true, label: "Full audit visibility" },
  SUPER_ADMIN: { canExport: true, label: "Full audit visibility" },
  AUDITOR: { canExport: true, label: "Full audit visibility" },
  CHAIRPERSON: {
    canExport: false,
    label: "Governance scope",
    entities: [
      "Loan",
      "LoanRepayment",
      "LoanApprovalMatrixState",
      "LoanApprovalMatrixStep",
      "LoanScheduleApproval",
      "CollectionAction",
      "AppSetting",
      "MemberRequest",
    ],
  },
  BOARD_MEMBER: {
    canExport: false,
    label: "Board oversight scope",
    entities: [
      "Loan",
      "LoanRepayment",
      "LoanApprovalMatrixState",
      "LoanApprovalMatrixStep",
      "CollectionAction",
      "AppSetting",
      "MemberRequest",
    ],
  },
  TREASURER: {
    canExport: true,
    label: "Finance and collections scope",
    entities: [
      "SavingsTransaction",
      "LedgerEntry",
      "Loan",
      "LoanRepayment",
      "CollectionAction",
      "MemberRequest",
      "AppSetting",
    ],
  },
  LOAN_OFFICER: {
    canExport: true,
    label: "Credit and collections scope",
    entities: [
      "Loan",
      "LoanRepayment",
      "LoanApprovalMatrixState",
      "LoanApprovalMatrixStep",
      "LoanScheduleApproval",
      "CollectionAction",
      "MemberRequest",
    ],
  },
};

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
  const scope = ROLE_AUDIT_SCOPE[role] ?? {
    canExport: false,
    label: "Scoped visibility",
  };
  const auditLogs = await ReportsService.auditTrail({
    saccoId,
    page,
    entities: scope.entities,
    actions: scope.actions,
  });
  const hasNextPage = auditLogs.length === 30;
  const auditRows = auditLogs.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    createdAt: entry.createdAt.toISOString(),
    actorName: entry.actor?.fullName ?? entry.actor?.email ?? "System",
    actorRole: entry.actor?.role ?? null,
    beforeJson: entry.beforeJson,
    afterJson: entry.afterJson,
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    Access scope: {scope.label}
                  </p>
                </div>

                <AuditLogsPanel logs={auditRows} canExport={scope.canExport} />

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
