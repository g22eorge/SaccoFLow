import Link from "next/link";
import { StartOrganizationForm } from "@/src/ui/components/start-organization-form";

export default function StartOrganizationPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-2 lg:items-center">
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">Start Free Trial</p>
        <h1 className="text-4xl font-bold leading-tight">
          Launch your SACCO workspace in minutes
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          We will create your organization, assign your first SACCO admin, and start your 30-day trial.
        </p>
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Need to access an existing account?{" "}
          <Link href="/sign-in" className="font-medium text-[#cc5500]">
            Go to sign in
          </Link>
        </div>
      </section>
      <StartOrganizationForm />
    </main>
  );
}
