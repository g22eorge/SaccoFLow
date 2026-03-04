import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotificationsPage() {
  return (
    <>
      <SiteHeader title="Notifications" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Alerts
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Notifications</h1>
                  <p className="mt-2 text-muted-foreground">
                    Monitor operational alerts, audit events, and risk signals.
                  </p>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <p className="text-sm text-muted-foreground">
                    Notification center is staged. For now, review live events in Audit Logs.
                  </p>
                  <div className="mt-4 text-sm">
                    <Link href="/dashboard/audit-logs" className="text-[#cc5500]">
                      Open audit activity
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
