import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";
import { formatMoney } from "@/src/lib/money";
import { ExternalCapitalPanel } from "@/src/ui/components/external-capital-panel";

export default async function ExternalCapitalPage({
  searchParams,
}: {
  searchParams?: {
    page?: string;
    type?: string;
    status?: string;
    source?: string;
    from?: string;
    to?: string;
  };
}) {
  const { saccoId, role } = await requireSaccoContext();
  if (!["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"].includes(role)) {
    redirect("/dashboard");
  }

  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const [rows, total, sourceBreakdown, monthlyTrend] = await Promise.all([
    ExternalCapitalService.list({
      saccoId,
      page,
      type: searchParams?.type,
      status: searchParams?.status,
      source: searchParams?.source,
      from: searchParams?.from ? new Date(searchParams.from) : undefined,
      to: searchParams?.to ? new Date(searchParams.to) : undefined,
    }),
    ExternalCapitalService.total(saccoId),
    ExternalCapitalService.sourceBreakdown(saccoId),
    ExternalCapitalService.monthlyTrend(saccoId),
  ]);

  const statusCounts = rows.reduce(
    (acc: Record<string, number>, row: (typeof rows)[number]) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const largeInflowCount = rows.filter((row: (typeof rows)[number]) => row.isLargeInflow).length;
  const amlFlaggedCount = rows.filter((row: (typeof rows)[number]) => row.amlFlag).length;
  const hasNextPage = rows.length === 30;

  return (
    <>
      <SiteHeader title="External Capital" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Funding
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Donations & External Capital</h1>
                  <p className="mt-2 text-muted-foreground">
                    Record donations, grants, and external funding separate from member savings and shares.
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Total external capital: {formatMoney(total.toString())}
                  </p>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">Capital Intelligence</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Recorded</p>
                      <p className="mt-1 text-xl font-semibold">{statusCounts.RECORDED ?? 0}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified</p>
                      <p className="mt-1 text-xl font-semibold">{statusCounts.VERIFIED ?? 0}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Posted</p>
                      <p className="mt-1 text-xl font-semibold">{statusCounts.POSTED ?? 0}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Large Inflows</p>
                      <p className="mt-1 text-xl font-semibold">{largeInflowCount}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">AML Flagged</p>
                      <p className="mt-1 text-xl font-semibold">{amlFlaggedCount}</p>
                    </article>
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-sm font-semibold">Top Funding Sources</p>
                      <div className="mt-2 space-y-2">
                        {sourceBreakdown.map((item: (typeof sourceBreakdown)[number]) => (
                          <p key={item.source} className="text-xs text-muted-foreground">
                            {item.source}: {formatMoney(item.total.toString())} ({item.count} txns)
                          </p>
                        ))}
                        {sourceBreakdown.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No source data yet.</p>
                        ) : null}
                      </div>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-sm font-semibold">6-Month Trend</p>
                      <div className="mt-2 space-y-2">
                        {monthlyTrend.map((item: (typeof monthlyTrend)[number]) => (
                          <p key={item.month} className="text-xs text-muted-foreground">
                            {item.month}: {formatMoney(item.total.toString())}
                          </p>
                        ))}
                        {monthlyTrend.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No trend data yet.</p>
                        ) : null}
                      </div>
                    </article>
                  </div>
                </section>

                <ExternalCapitalPanel
                  rows={rows.map((row: (typeof rows)[number]) => ({
                    id: row.id,
                    type: row.type,
                    amount: row.amount.toString(),
                    baseAmount: row.baseAmount.toString(),
                    currency: row.currency,
                    fxRate: row.fxRate.toString(),
                    status: row.status,
                    verificationLevel: row.verificationLevel,
                    amlFlag: row.amlFlag,
                    isLargeInflow: row.isLargeInflow,
                    source: row.source,
                    allocationBucket: row.allocationBucket,
                    reference: row.reference,
                    documentUrl: row.documentUrl,
                    note: row.note,
                    correctionOfId: row.correctionOfId,
                    receivedAt: row.receivedAt.toISOString(),
                  }))}
                  canCreate={["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"].includes(role)}
                  canManage={["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"].includes(role)}
                />

                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href="/api/external-capital/export?format=csv"
                      className="rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Export CSV
                    </Link>
                    <Link
                      href="/api/external-capital/export?format=pdf"
                      className="rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Export PDF
                    </Link>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Link
                      href={page > 1 ? `/dashboard/external-capital?page=${page - 1}` : "#"}
                      className={`text-sm ${page > 1 ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Previous
                    </Link>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Link
                      href={hasNextPage ? `/dashboard/external-capital?page=${page + 1}` : "#"}
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
