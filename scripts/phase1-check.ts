import { prisma } from "@/src/server/db/prisma";

async function main() {
  const requiredEnv = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "NEXT_PUBLIC_APP_URL",
  ] as const;

  const missing = requiredEnv.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  await prisma.$queryRaw`SELECT 1`;
  const tableChecks = await Promise.all([
    prisma.sacco.count(),
    prisma.appUser.count(),
    prisma.user.count(),
    prisma.account.count(),
    prisma.session.count(),
  ]);

  console.log("Phase 1 health check passed.");
  console.log(`Sacco records: ${tableChecks[0]}`);
  console.log(`AppUser records: ${tableChecks[1]}`);
  console.log(`Auth users: ${tableChecks[2]}`);
  console.log(`Auth accounts: ${tableChecks[3]}`);
  console.log(`Auth sessions: ${tableChecks[4]}`);
}

main()
  .catch((error) => {
    console.error("Phase 1 check failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
