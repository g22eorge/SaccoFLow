import { redirect } from "next/navigation";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { SettingsService } from "@/src/server/services/settings.service";
import { SettingsForm } from "@/src/ui/forms/settings-form";

const VIEW_ROLES = [
  "SACCO_ADMIN",
  "SUPER_ADMIN",
  "TREASURER",
  "AUDITOR",
  "LOAN_OFFICER",
];

const EDIT_ROLES = ["SACCO_ADMIN", "SUPER_ADMIN"];

export default async function SettingsPage() {
  const { saccoId, role } = await requireSaccoContext();
  if (!VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const settings = await SettingsService.get(saccoId);
  const canEdit = EDIT_ROLES.includes(role);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Configuration
        </p>
        <h1 className="mt-2 text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-slate-600">
          Configure SACCO-wide operational policies, including interest rates,
          overdue handling, approvals, compliance, and feature flags.
        </p>
      </div>

      <SettingsForm initialSettings={settings} canEdit={canEdit} />
    </section>
  );
}
