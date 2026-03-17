import Link from "next/link";

const trustBlocks = [
  "Role-based approvals for loan and finance workflows",
  "Member-friendly language and guided screens",
  "Receipts, exports, and reporting when you need them",
  "PesaPal support for subscription and member payments",
];

const roleBlocks = [
  {
    title: "For SACCO Leaders",
    detail: "See membership health, lending activity, and policy performance from one place.",
  },
  {
    title: "For Treasurers",
    detail: "Track savings, shares, receipts, billing, and financial reports with less manual work.",
  },
  {
    title: "For Loan Teams",
    detail: "Review applications faster, follow guarantors clearly, and act on overdue cases earlier.",
  },
];

const planBlocks = [
  {
    title: "Starter",
    members: "Up to 200 members",
    note: "UGX 30,000 monthly - best for new or early-stage SACCO operations",
    highlights: ["Daily savings and loan work", "Member records and reports"],
  },
  {
    title: "Tier 2",
    members: "Up to 500 members",
    note: "UGX 45,000 monthly - for growing SACCOs with rising savings and loan activity",
    highlights: ["Growing team workflows", "Better room for active lending"],
  },
  {
    title: "Tier 3",
    members: "Up to 1,000 members",
    note: "UGX 60,000 monthly - supports busy lending, collections, and reporting work",
    highlights: ["Busy collections support", "Stronger reporting comfort"],
    featured: true,
  },
  {
    title: "Tier 4",
    members: "Up to 2,500 members",
    note: "UGX 90,000 monthly - for larger SACCO teams and heavier operational demand",
    highlights: ["Larger team coordination", "More demanding daily volume"],
  },
  {
    title: "Tier 5",
    members: "Up to 5,000 members",
    note: "UGX 120,000 monthly - for high-volume SACCO operations across multiple workflows",
    highlights: ["High-volume operations", "Best fit for larger SACCO growth"],
  },
];

export function PublicHomeClient({ nextUrl }: { nextUrl: string }) {
  return (
    <main className="min-h-screen bg-[#fffaf5] [color-scheme:light]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-6 lg:px-10 lg:py-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-[#f3e2cf] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#cc5500]">
              SACCOFlow
            </p>
            <p className="mt-1 text-xs text-[#374151]">
              Trusted operations for savings, loans, and member service
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link href="/start" className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium">
              Start Free Trial
            </Link>
            <Link
              href={`/sign-in?next=${encodeURIComponent(nextUrl)}`}
              className="rounded-md bg-[#cc5500] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Sign In
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#cc5500]">
              Trusted SACCO Operations
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] text-[#111827] lg:text-6xl">
              Manage savings, loans, approvals, and member service from one trusted SACCO workspace.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#374151]">
              Give your team clear records, faster loan decisions, guided member workflows, receipts, and reports
              without complicated financial jargon. Start your 30-day free trial, onboard members quickly, and
              move to a paid tier only when your SACCO is ready.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/start"
                className="rounded-lg bg-[#cc5500] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                Start Free Trial
              </Link>
              <Link href="/sign-in" className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium">
                Sign In To Existing Workspace
              </Link>
            </div>
          </div>

          <div className="relative self-start">
            <div className="relative space-y-4 rounded-[28px] border border-[#f1dfcf] bg-white p-4 shadow-lg lg:p-5">
              <div className="overflow-hidden rounded-2xl border bg-[#fff7ed]">
                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_220px] lg:items-center">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#1f2937]">Live Workspace</p>
                        <p className="mt-1 text-sm font-semibold text-[#111827]">Today&apos;s SACCO activity</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#cc5500]">
                        Audit Ready
                      </span>
                    </div>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-[#374151]">
                      Savings, approvals, receipts, and lending activity aligned in one simple daily view.
                    </p>
                  </div>
                  <div className="mx-auto w-full max-w-[220px] rounded-[24px] border-2 border-[#efc9a4] bg-white p-3 shadow-md lg:max-w-[230px]">
                    <div className="rounded-2xl bg-[#fff1e2] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a6b45]">Money view</p>
                          <p className="mt-1 text-sm font-semibold text-[#111827]">Savings and loan activity</p>
                        </div>
                        <div className="rounded-xl bg-white px-2.5 py-1.5 text-base font-bold text-[#cc5500] shadow-sm">
                          UGX
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-[#efc9a4] bg-white p-3 shadow-sm">
                          <div className="text-2xl leading-none">🧾</div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-[#1f2937]">Receipt</p>
                            <p className="mt-1 text-sm font-semibold text-[#111827]">Receipts and records stay clear</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl border border-[#efc9a4] bg-white p-3 shadow-sm">
                          <div className="flex -space-x-3">
                            <span className="grid h-10 w-10 place-items-center rounded-full border-4 border-[#cc5500] bg-[#fff7ed] text-base">🪙</span>
                            <span className="grid h-10 w-10 place-items-center rounded-full border-4 border-[#e58d42] bg-[#fff1e2] text-base">🪙</span>
                            <span className="grid h-10 w-10 place-items-center rounded-full border-4 border-[#f2b36f] bg-[#fff7ed] text-base">🪙</span>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-[#1f2937]">Savings</p>
                            <p className="mt-1 text-sm font-semibold text-[#111827]">Member contributions in view</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#efc9a4] bg-white p-3 shadow-sm">
                          <p className="text-[10px] uppercase tracking-wide text-[#1f2937]">Cash Flow</p>
                          <div className="mt-3 flex items-end gap-2">
                            <span className="h-7 w-3 rounded-full bg-[#f3c79f]" />
                            <span className="h-10 w-3 rounded-full bg-[#e79954]" />
                            <span className="h-14 w-3 rounded-full bg-[#cc5500]" />
                            <span className="h-9 w-3 rounded-full bg-[#f0b87a]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <article className="rounded-xl border bg-white px-3 py-3 text-sm text-[#374151] shadow-sm">
                  <p className="font-semibold text-[#111827]">30-day free trial</p>
                  <p className="mt-1 text-xs text-[#374151]">Start working before your first subscription payment.</p>
                </article>
                <article className="rounded-xl border bg-white px-3 py-3 text-sm text-[#374151] shadow-sm">
                  <p className="font-semibold text-[#111827]">Role-based approvals</p>
                  <p className="mt-1 text-xs text-[#374151]">Keep review and decision steps clear across your team.</p>
                </article>
                <article className="rounded-xl border bg-white px-3 py-3 text-sm text-[#374151] shadow-sm">
                  <p className="font-semibold text-[#111827]">Audit trail included</p>
                  <p className="mt-1 text-xs text-[#374151]">Track who changed, approved, or posted each key action.</p>
                </article>
                <article className="rounded-xl border bg-white px-3 py-3 text-sm text-[#374151] shadow-sm">
                  <p className="font-semibold text-[#111827]">Receipts and exports</p>
                  <p className="mt-1 text-xs text-[#374151]">Download records and reports when your SACCO needs them.</p>
                </article>
              </div>

            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border bg-white px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#1f2937]">Setup</p>
            <p className="mt-2 text-2xl font-bold text-[#111827]">30 days</p>
            <p className="mt-1 text-sm text-[#374151]">Free trial before your first bill</p>
          </article>
          <article className="rounded-xl border bg-white px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#1f2937]">Controls</p>
            <p className="mt-2 text-2xl font-bold text-[#111827]">Audit-ready</p>
            <p className="mt-1 text-sm text-[#374151]">Approvals, receipts, exports, and traceable actions</p>
          </article>
          <article className="rounded-xl border bg-white px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#1f2937]">Scale</p>
            <p className="mt-2 text-2xl font-bold text-[#111827]">5 tiers</p>
            <p className="mt-1 text-sm text-[#374151]">Start small and grow up to 5,000 members</p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">How it works</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border bg-[#fffaf5] px-4 py-3">
              <p className="text-xs text-[#1f2937]">Step 1</p>
              <h3 className="mt-1 text-sm font-semibold">Register your SACCO</h3>
              <p className="mt-1 text-sm text-[#374151]">
                Create your organization, admin login, and trial workspace in minutes.
              </p>
            </article>
            <article className="rounded-lg border bg-[#fffaf5] px-4 py-3">
              <p className="text-xs text-[#1f2937]">Step 2</p>
              <h3 className="mt-1 text-sm font-semibold">Onboard members</h3>
              <p className="mt-1 text-sm text-[#374151]">
                Add member records, collect savings, and process loan requests safely.
              </p>
            </article>
            <article className="rounded-lg border bg-[#fffaf5] px-4 py-3">
              <p className="text-xs text-[#1f2937]">Step 3</p>
              <h3 className="mt-1 text-sm font-semibold">Activate subscription</h3>
              <p className="mt-1 text-sm text-[#374151]">
                Continue after trial using affordable monthly or annual billing through PesaPal.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Why SACCOFlow</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {trustBlocks.map((item) => (
              <article key={item} className="rounded-lg border bg-[#fffaf5] px-4 py-3">
                <p className="text-sm text-[#374151]">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Built For Your Team</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {roleBlocks.map((block) => (
              <article key={block.title} className="rounded-lg border bg-[#fffaf5] px-4 py-4">
                <h3 className="text-sm font-semibold text-[#111827]">{block.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#374151]">{block.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Pricing</p>
            <h2 className="mt-2 text-2xl font-bold text-[#111827]">Choose the member tier that fits your SACCO today.</h2>
            <p className="mt-2 text-sm leading-6 text-[#374151]">
              Start from UGX 30,000 per month and move up only when your member base and daily work increase.
            </p>
          </div>
            <div className="rounded-xl border bg-[#fffaf5] px-4 py-3 text-sm text-[#374151]">
              Pay monthly or switch to annual billing after trial through PesaPal.
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {planBlocks.map((plan) => (
            <article
              key={plan.title}
              className={`flex h-full flex-col rounded-xl border px-5 py-4 shadow-sm ${
                plan.featured ? "border-[#cc5500] bg-[#fff7ed]" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-[#cc5500]">{plan.title}</p>
                {plan.featured ? (
                  <span className="rounded-full bg-[#cc5500] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-[#111827]">{plan.members}</p>
              <p className="mt-2 text-sm leading-6 text-[#374151]">{plan.note}</p>
              <div className="mt-4 rounded-lg bg-black/[0.03] px-3 py-2 text-sm font-semibold text-[#111827]">
                Monthly billing tier
              </div>
              <div className="mt-4 space-y-2 text-xs text-[#374151]">
                {plan.highlights.map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
              <Link
                href="/start"
                className={`mt-5 inline-flex rounded-lg px-3 py-2 text-sm font-semibold ${
                  plan.featured
                    ? "bg-[#cc5500] text-white"
                    : "border border-border text-[#111827]"
                }`}
              >
                Start With {plan.title}
              </Link>
            </article>
          ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-[#fff7ed] p-5 shadow-sm lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Start Today</p>
          <h2 className="mt-2 text-2xl font-bold text-[#111827]">
            Create your SACCO workspace and start your 30-day free trial.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#374151]">
            Set up your organization, add your team, onboard members, and begin working before your first bill is due.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/start" className="rounded-lg bg-[#cc5500] px-4 py-2 text-sm font-semibold text-white">
              Start Free Trial
            </Link>
            <Link href="/sign-in" className="rounded-lg border border-border px-4 py-2 text-sm">
              Sign In To Existing Workspace
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm lg:p-6">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Before You Commit</p>
              <h2 className="mt-2 text-2xl font-bold text-[#111827]">See how daily SACCO work becomes simpler.</h2>
                <p className="mt-2 text-sm leading-6 text-[#374151]">
                From member onboarding to loan approvals, repayments, collections, receipts, and reports,
                your team gets one guided system instead of scattered records and manual follow-up.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border bg-[#fffaf5] px-4 py-4">
                <p className="text-sm font-semibold text-[#111827]">Approvals with accountability</p>
                <p className="mt-1 text-sm text-[#374151]">Track who approved, posted, reviewed, or changed each important action.</p>
              </article>
              <article className="rounded-xl border bg-[#fffaf5] px-4 py-4">
                <p className="text-sm font-semibold text-[#111827]">Member-friendly workflows</p>
                <p className="mt-1 text-sm text-[#374151]">Use plain language screens that are easier for staff and members to follow.</p>
              </article>
              <article className="rounded-xl border bg-[#fffaf5] px-4 py-4">
                <p className="text-sm font-semibold text-[#111827]">Financial control built in</p>
                <p className="mt-1 text-sm text-[#374151]">Receipts, exports, repayment tracking, and audit history stay available when you need them.</p>
              </article>
              <article className="rounded-xl border bg-[#fffaf5] px-4 py-4">
                <p className="text-sm font-semibold text-[#111827]">Ready to grow</p>
                <p className="mt-1 text-sm text-[#374151]">Move up by member tier as your SACCO expands without changing systems.</p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
