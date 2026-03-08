import Link from "next/link";

const featureBlocks = [
  {
    title: "Simple Daily Work",
    detail:
      "Track savings, borrowing, repayments, and share purchases with guided steps.",
  },
  {
    title: "Real Accountability",
    detail:
      "Every key action is auditable, from approvals and disbursement to collections and exports.",
  },
  {
    title: "Built for Growth",
    detail:
      "Start small, then scale by member tier, organization, and payment channels.",
  },
];

const planBlocks = [
  {
    title: "Starter",
    members: "Up to 200 members",
    note: "Best for early-stage SACCO operations",
  },
  {
    title: "Tier 2",
    members: "Up to 1,000 members",
    note: "For growing SACCOs with active loan demand",
  },
  {
    title: "Tier 3",
    members: "Large-scale operations",
    note: "Advanced support for high-volume workflows",
  },
];

export function PublicHomeClient({ nextUrl }: { nextUrl: string }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,#fef3e8_0%,#fff_35%,#fff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#cc5500]">
            SACCOFlow
          </p>
          <div className="flex items-center gap-2">
            <Link href="/start" className="rounded-md border border-border px-3 py-1.5 text-sm">
              Start Free Trial
            </Link>
            <Link
              href={`/sign-in?next=${encodeURIComponent(nextUrl)}`}
              className="rounded-md bg-[#cc5500] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Sign In
            </Link>
          </div>
        </header>

        <section className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
              Finance Management for SACCOs
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-[#111827] lg:text-5xl">
              Grow your SACCO with clear workflows, trusted records, and member-friendly tools.
            </h1>
            <p className="mt-4 max-w-xl text-base text-[#4b5563]">
              SACCOFlow helps teams and members manage savings, loans, and repayments without technical jargon.
              Start a 30-day free trial, onboard your members, and pay only when you are ready.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/start"
                className="rounded-lg bg-[#cc5500] px-4 py-2 text-sm font-semibold text-white"
              >
                Create Organization
              </Link>
              <Link href="/sign-in" className="rounded-lg border border-border px-4 py-2 text-sm">
                Existing Account Sign In
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {featureBlocks.map((block) => (
              <article key={block.title} className="rounded-xl border bg-white px-5 py-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[#111827]">{block.title}</h3>
                <p className="mt-1 text-sm text-[#6b7280]">{block.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">How it works</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border bg-[#fffaf5] px-4 py-3">
              <p className="text-xs text-muted-foreground">Step 1</p>
              <h3 className="mt-1 text-sm font-semibold">Register your SACCO</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your organization, admin login, and trial workspace in minutes.
              </p>
            </article>
            <article className="rounded-lg border bg-[#fffaf5] px-4 py-3">
              <p className="text-xs text-muted-foreground">Step 2</p>
              <h3 className="mt-1 text-sm font-semibold">Onboard members</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add member records, collect savings, and process loan requests safely.
              </p>
            </article>
            <article className="rounded-lg border bg-[#fffaf5] px-4 py-3">
              <p className="text-xs text-muted-foreground">Step 3</p>
              <h3 className="mt-1 text-sm font-semibold">Activate subscription</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Continue after trial using monthly or annual billing through PesaPal.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {planBlocks.map((plan) => (
            <article key={plan.title} className="rounded-xl border bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[#cc5500]">{plan.title}</p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">{plan.members}</p>
              <p className="mt-1 text-sm text-[#6b7280]">{plan.note}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
