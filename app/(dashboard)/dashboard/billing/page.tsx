import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { BillingService } from "@/src/server/services/billing.service";
import { BillingCtaCard } from "@/src/ui/components/billing-cta-card";

export default async function BillingPage() {
  const { saccoId, role } = await requireSaccoContext();
  const access = await BillingService.getAccessState(saccoId);
  const canManage = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"].includes(role);

  return (
    <>
      <SiteHeader title="Billing" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Payments</p>
                  <h1 className="mt-2 text-2xl font-bold">Subscription & Trial</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start with a 30-day trial, then continue with monthly payment through PesaPal.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-lg border bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Status</p>
                    <p className="mt-2 text-xl font-semibold">{access.subscription.status}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Plan: {access.subscription.plan} ({access.subscription.billingCycle})
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Trial ends: {access.subscription.trialEndsAt.toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Selected fee: {access.subscription.currency} {access.selectedAmount.toString()}
                    </p>
                  </section>

                  <BillingCtaCard
                    canManage={canManage}
                    trialDaysLeft={access.trialDaysLeft}
                    status={access.subscription.status}
                    currentPlan={access.subscription.plan}
                    currentCycle={access.subscription.billingCycle}
                    currency={access.subscription.currency}
                    usage={access.usage}
                    planOptions={access.planOptions.map((plan) => ({
                      ...plan,
                      monthlyAmount: plan.monthlyAmount.toString(),
                      annualAmount: plan.annualAmount.toString(),
                    }))}
                  />
                </div>

                <section className="rounded-lg border bg-card p-5">
                  <h2 className="text-lg font-semibold">Recent Billing Events</h2>
                  <div className="mt-3 overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Event</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {access.subscription.billingEvents.map((event) => (
                          <tr key={event.id} className="border-t">
                            <td className="px-3 py-2 text-xs">{event.createdAt.toLocaleString()}</td>
                            <td className="px-3 py-2 text-xs">{event.eventType}</td>
                            <td className="px-3 py-2 text-xs">{event.status}</td>
                            <td className="px-3 py-2 text-xs font-semibold">
                              {event.currency} {event.amount.toString()}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{event.reference ?? "-"}</td>
                          </tr>
                        ))}
                        {access.subscription.billingEvents.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-xs text-muted-foreground" colSpan={5}>
                              No billing events yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
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
