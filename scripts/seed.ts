import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sacco = await prisma.sacco.upsert({
    where: { code: "SACCOFLOW-DEMO" },
    update: {},
    create: {
      name: "SACCOFlow Demo",
      code: "SACCOFLOW-DEMO",
    },
  });

  await prisma.appUser.upsert({
    where: { authUserId: "seed-admin-auth-id" },
    update: {},
    create: {
      saccoId: sacco.id,
      authUserId: "seed-admin-auth-id",
      email: "admin@example.com",
      fullName: "Seed Admin",
      role: Role.SACCO_ADMIN,
    },
  });

  const roleSeeds = [
    {
      authUserId: "seed-treasurer-auth-id",
      email: "treasurer@example.com",
      role: Role.TREASURER,
    },
    {
      authUserId: "seed-loan-officer-auth-id",
      email: "loanofficer@example.com",
      role: Role.LOAN_OFFICER,
    },
    {
      authUserId: "seed-auditor-auth-id",
      email: "auditor@example.com",
      role: Role.AUDITOR,
    },
  ];

  for (const roleSeed of roleSeeds) {
    await prisma.appUser.upsert({
      where: { authUserId: roleSeed.authUserId },
      update: {},
      create: {
        saccoId: sacco.id,
        authUserId: roleSeed.authUserId,
        email: roleSeed.email,
        fullName: roleSeed.email.split("@")[0],
        role: roleSeed.role,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
