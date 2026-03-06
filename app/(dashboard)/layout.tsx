import { requireAuth, requireSaccoContext } from "@/src/server/auth/rbac";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { AssumeTenantBanner } from "@/src/ui/components/assume-tenant-banner";
import { prisma } from "@/src/server/db/prisma";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuth();
  const context = await requireSaccoContext();
  const { role } = context;

  if (String(role) === "PLATFORM_SUPER_ADMIN") {
    redirect("/platform");
  }

  const [pendingLoanRequests, pendingMemberRequests] = await Promise.all([
    prisma.loan.count({
      where: {
        saccoId: context.saccoId,
        status: "PENDING",
      },
    }),
    prisma.auditLog.count({
      where: {
        saccoId: context.saccoId,
        entity: "MemberRequest",
        afterJson: {
          contains: '"status":"PENDING"',
        },
      },
    }),
  ]);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        role={role}
        badges={{
          pendingLoanRequests,
          pendingMemberRequests,
        }}
        user={{
          name: session.user.name ?? "SACCO User",
          email: session.user.email ?? "user@sacco.com",
        }}
      />
      <SidebarInset>
        {context.assumedTenant ? (
          <AssumeTenantBanner
            saccoCode={context.assumedTenant.saccoCode}
            reason={context.assumedTenant.reason}
          />
        ) : null}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
