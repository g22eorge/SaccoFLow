import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AccountCenter } from "@/src/ui/components/account-center";
import { ROLE_DESCRIPTIONS, ROLE_LEVELS, type SaccoRole } from "@/src/lib/roles";

export default async function AccountPage() {
  const { id: actorId, role, saccoId } = await requireSaccoContext();
  const profile = await prisma.appUser.findFirst({
    where: { id: actorId, saccoId, isActive: true },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      jobTitle: true,
      branch: true,
      timezone: true,
      locale: true,
      avatarUrl: true,
      role: true,
      saccoId: true,
      authUserId: true,
      notifyEmail: true,
      notifySms: true,
      notifyWhatsapp: true,
      notifyRepaymentReminderDays: true,
    },
  });

  if (!profile) {
    throw new Error("Account profile not found");
  }

  const sessions = await prisma.session.findMany({
    where: { userId: profile.authUserId },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const roleLevel =
    role in ROLE_LEVELS
      ? `Level ${ROLE_LEVELS[role as SaccoRole]}`
      : role === "PLATFORM_SUPER_ADMIN"
        ? "Platform"
        : "System";
  const roleDescription =
    role in ROLE_DESCRIPTIONS
      ? ROLE_DESCRIPTIONS[role as SaccoRole]
      : role === "PLATFORM_SUPER_ADMIN"
        ? "Platform-level technical superadmin scope."
        : "Operational role";
  const roleScope =
    role === "PLATFORM_SUPER_ADMIN"
      ? "Platform Support and Tenant Guidance"
      : `SACCO Scoped Access (${saccoId})`;

  return (
    <>
      <SiteHeader title="Account" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Profile
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Account</h1>
                  <p className="mt-2 text-muted-foreground">
                    Your workspace identity and access context.
                  </p>
                </div>

                <AccountCenter
                  profile={profile}
                  sessions={sessions.map((session) => ({
                    id: session.id,
                    createdAt: session.createdAt.toISOString(),
                    expiresAt: session.expiresAt.toISOString(),
                    ipAddress: session.ipAddress,
                    userAgent: session.userAgent,
                  }))}
                  roleLevel={roleLevel}
                  roleDescription={roleDescription}
                  roleScope={roleScope}
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
