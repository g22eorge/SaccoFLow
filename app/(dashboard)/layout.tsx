import { requireAuth } from "@/src/server/auth/rbac";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAuth();

  return <>{children}</>;
}
