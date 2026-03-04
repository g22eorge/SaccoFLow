import { requireAuth, requireSaccoContext } from "@/src/server/auth/rbac";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuth();
  const { role } = await requireSaccoContext();

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        role={role}
        user={{
          name: session.user.name ?? "SACCO User",
          email: session.user.email ?? "user@sacco.com",
        }}
      />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
