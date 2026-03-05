import Link from "next/link";
import { requirePlatformSuperAdmin } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { PlatformProfileForm } from "@/src/ui/components/platform-profile-form";
import { LogoutButton } from "@/src/ui/components/logout-button";

export default async function PlatformProfilePage() {
  const actor = await requirePlatformSuperAdmin();
  const profile = await prisma.appUser.findUnique({
    where: { id: actor.id },
    select: {
      email: true,
      fullName: true,
      role: true,
    },
  });

  if (!profile) {
    throw new Error("Profile not found");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <Link href="/platform" className="text-sm text-[#cc5500]">
            Back to platform console
          </Link>
          <LogoutButton />
        </div>

        <section className="rounded-lg border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
            Platform Account
          </p>
          <h1 className="mt-2 text-2xl font-bold">My Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Role: {profile.role}
          </p>
        </section>

        <PlatformProfileForm
          email={profile.email}
          fullName={profile.fullName ?? "Platform Super Admin"}
        />
      </section>
    </main>
  );
}
