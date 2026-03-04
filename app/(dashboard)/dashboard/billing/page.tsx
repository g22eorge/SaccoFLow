import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function BillingPage() {
  return (
    <>
      <SiteHeader title="Billing" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Financial Controls
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Billing</h1>
                  <p className="mt-2 text-muted-foreground">
                    Subscription, invoicing, and SACCO cost controls.
                  </p>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <p className="text-sm text-muted-foreground">
                    Billing module is staged. Use reports and settings for current financial operations.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <Link href="/dashboard/reports" className="text-[#cc5500]">
                      Open reports
                    </Link>
                    <Link href="/dashboard/settings" className="text-[#cc5500]">
                      Open settings
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
