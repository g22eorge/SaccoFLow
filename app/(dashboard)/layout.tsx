import Link from "next/link";
import { Role } from "@prisma/client";
import { requireAuth, requireSaccoContext } from "@/src/server/auth/rbac";
import { LogoutButton } from "@/src/ui/components/logout-button";

const links = [
  { href: "/dashboard", label: "Overview" },
  {
    href: "/users",
    label: "Users",
    roles: ["SACCO_ADMIN", "SUPER_ADMIN"] as Role[],
  },
  { href: "/members", label: "Members" },
  { href: "/savings", label: "Savings" },
  { href: "/loans", label: "Loans" },
  {
    href: "/settings",
    label: "Settings",
    roles: [
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ] as Role[],
  },
  {
    href: "/reports",
    label: "Reports",
    roles: [
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "TREASURER",
      "AUDITOR",
      "LOAN_OFFICER",
    ] as Role[],
  },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuth();
  const { role } = await requireSaccoContext();
  const visibleLinks = links.filter(
    (link) => !link.roles || link.roles.includes(role),
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4">
          <div className="rounded-2xl border border-border bg-surface-soft px-3.5 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex w-full min-w-0 flex-col items-center text-center">
                <p className="mx-auto text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
                  SACCOFLOW
                </p>
                <h1 className="mx-auto mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
                  SACCO Operations Console
                </h1>
                <p className="mx-auto mt-1 max-w-2xl text-sm font-medium text-slate-600">
                  Manage members, savings, loans, settings, and reports from one
                  place.
                </p>
              </div>
              <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">
                <p className="max-w-56 truncate rounded-full border border-border bg-background px-3 py-1 text-xs text-slate-500">
                  {session.user.email}
                </p>
                <p className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold">
                  {role.replaceAll("_", " ")}
                </p>
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-6 pb-32 sm:px-6 sm:py-8">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface px-3 py-2"
        style={{
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div
          className="horizontal-scroll mx-auto flex max-w-7xl flex-nowrap items-center gap-2 overflow-x-auto"
          aria-label="Bottom navigation"
        >
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-xl border border-border bg-background px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
