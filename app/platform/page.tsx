import {
  getAssumedTenant,
  requireAuth,
  requirePlatformSuperAdmin,
} from "@/src/server/auth/rbac";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { prisma } from "@/src/server/db/prisma";
import { PlatformAssumeTenant } from "@/src/ui/components/platform-assume-tenant";
import Link from "next/link";
import { LogoutButton } from "@/src/ui/components/logout-button";

export default async function PlatformPage() {
  const session = await requireAuth();
  const context = await requirePlatformSuperAdmin();
  const [activeAssumption, tenants] = await Promise.all([
    getAssumedTenant(),
    prisma.sacco.findMany({
      select: { code: true, name: true },
      orderBy: { code: "asc" },
      take: 50,
    }),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <Link href="/platform/profile" className="text-sm text-[#cc5500]">
              Profile management
            </Link>
          </div>
          <LogoutButton />
        </div>

        <div className="rounded-lg border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
            Platform Control
          </p>
          <h1 className="mt-2 text-2xl font-bold">Technical Superadmin Console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This workspace is reserved for platform support, diagnostics, and tenant guidance.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-md border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed In As</p>
            <p className="mt-1 text-sm font-medium">{session.user.email ?? "-"}</p>
          </article>
          <article className="rounded-md border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Platform Role</p>
            <p className="mt-1 text-sm font-medium">{context.role}</p>
          </article>
        </div>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Guardrails</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Platform actions stay separate from SACCO operational approvals.</li>
            <li>Financial workflows remain under SACCO governance roles.</li>
            <li>Use this role for technical guidance and support operations.</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Last loaded: {formatDateTimeUtc(new Date())}
          </p>
        </section>

        <PlatformAssumeTenant tenants={tenants} activeAssumption={activeAssumption} />
      </section>
    </main>
  );
}
