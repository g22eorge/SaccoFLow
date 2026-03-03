import Link from "next/link";

export default function MarketingHome() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-14">
      <section className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
          SACCOFlow
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Digital core operations for SACCOs
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-600">
          Manage members, savings, loans, repayments, and reporting with a
          mobile-first workflow and role-based control.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sign-in"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold"
          >
            Open Dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-semibold">Members</p>
          <p className="mt-1 text-sm text-slate-600">
            Member registry with editable profiles and sequenced IDs.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-semibold">Savings & Loans</p>
          <p className="mt-1 text-sm text-slate-600">
            End-to-end money flows with audit trails and role controls.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-semibold">Reports</p>
          <p className="mt-1 text-sm text-slate-600">
            Operations dashboard, statements, and compliance-ready logs.
          </p>
        </article>
      </section>
    </main>
  );
}
