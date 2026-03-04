import { requireSaccoContext } from "@/src/server/auth/rbac";
import { DashboardService } from "@/src/server/services/dashboard.service";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";

export default async function Page() {
  const { saccoId } = await requireSaccoContext();
  const dashboard = await DashboardService.monitors(saccoId);

  const data = dashboard.recentActivity.map((event) => ({
    id: event.id,
    label: event.label,
    date: event.when.toISOString(),
  }));

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards dashboard={dashboard} />
            <div className="px-4 lg:px-6">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Loan Cashflow 30d</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Disbursed</p>
                    <p className="text-2xl font-bold">{dashboard.monitors.monthlyDisbursed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Repaid</p>
                    <p className="text-2xl font-bold">{dashboard.monitors.monthlyRepaid}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Flow</p>
                    <p className={`text-2xl font-bold ${Number(dashboard.monitors.monthlyLoanNet) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {dashboard.monitors.monthlyLoanNet}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
