import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { SettingsService } from "@/src/server/services/settings.service";
import { SettingsForm } from "@/src/ui/forms/settings-form";
import { SiteHeader } from "@/components/site-header";

const VIEW_ROLES = [
  "SACCO_ADMIN",
  "SUPER_ADMIN",
  "CHAIRPERSON",
  "BOARD_MEMBER",
  "TREASURER",
  "AUDITOR",
  "LOAN_OFFICER",
];

const EDIT_ROLES = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"];

export default async function SettingsPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const settings = await SettingsService.get(saccoId);
  const versions = await SettingsService.listVersions(saccoId, 12);
  const canEdit = EDIT_ROLES.includes(role);

  return (
    <>
      <SiteHeader title="Settings" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Configuration
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Settings</h1>
                  <p className="mt-2 text-muted-foreground">
                    Configure SACCO-wide operational policies, including interest rates,
                    overdue handling, approvals, compliance, and feature flags.
                  </p>
                </div>

                <SettingsForm initialSettings={settings} initialVersions={versions} canEdit={canEdit} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
