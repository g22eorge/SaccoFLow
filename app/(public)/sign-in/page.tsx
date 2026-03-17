import Link from "next/link";
import { SignInPanel } from "@/src/ui/components/sign-in-panel";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const rawNext = searchParams?.next;
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  return (
    <main className="min-h-screen bg-[#fffaf5] [color-scheme:light]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-2 lg:items-center">
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Welcome Back</p>
        <h1 className="text-4xl font-bold leading-tight">Sign in to your SACCO workspace</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Access your organization dashboard, member records, and workflow actions securely.
        </p>
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          New organization?{" "}
          <Link href="/start" className="font-medium text-[#cc5500]">
            Create a SACCO account
          </Link>
        </div>
        <Link href="/" className="inline-flex text-sm font-medium text-[#cc5500]">
          Back to landing page
        </Link>
      </section>
      <SignInPanel nextUrl={nextUrl} />
      </div>
    </main>
  );
}
