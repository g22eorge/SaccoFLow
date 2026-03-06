import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { AiInsightsService } from "@/src/server/services/ai-insights.service";
import { AiInsightsPanel } from "@/src/ui/components/ai-insights-panel";

export default async function AiInsightsPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (
    ![
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "CHAIRPERSON",
      "BOARD_MEMBER",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ].includes(role)
  ) {
    redirect("/dashboard");
  }

  const insights = await AiInsightsService.getOverview(saccoId);

  return (
    <>
      <SiteHeader title="AI Insights" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Intelligence Layer
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">AI Operations Center</h1>
                  <p className="mt-2 text-muted-foreground">
                    Unified AI assistants for credit, collections, compliance, donor intelligence, and board decisions.
                  </p>
                </div>

                <AiInsightsPanel insights={insights} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
