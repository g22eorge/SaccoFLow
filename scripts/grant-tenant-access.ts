import { Role } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";

type CliOptions = {
  email?: string;
  saccoCode?: string;
  role?: Role;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];
    if ((current === "--email" || current === "-e") && next) {
      options.email = next.toLowerCase();
      index += 1;
    } else if (current === "--sacco-code" && next) {
      options.saccoCode = next;
      index += 1;
    } else if (current === "--role" && next) {
      options.role = next as Role;
      index += 1;
    }
  }

  return options;
};

async function main() {
  const args = parseArgs();
  if (!args.email || !args.saccoCode) {
    throw new Error(
      "Usage: bun run tenant:grant-access -- --email user@example.com --sacco-code ORG2 [--role SUPER_ADMIN]",
    );
  }

  const appUser = await prisma.appUser.findFirst({
    where: { email: args.email, isActive: true },
    select: { authUserId: true, role: true },
  });

  if (!appUser) {
    throw new Error("Active app user not found for supplied email");
  }

  const sacco = await prisma.sacco.findUnique({
    where: { code: args.saccoCode },
    select: { id: true, code: true, name: true },
  });

  if (!sacco) {
    throw new Error("SACCO not found for supplied code");
  }

  const role = args.role ?? appUser.role;
  await prisma.appUserTenantAccess.upsert({
    where: {
      authUserId_saccoId: {
        authUserId: appUser.authUserId,
        saccoId: sacco.id,
      },
    },
    update: {
      role,
      isActive: true,
    },
    create: {
      authUserId: appUser.authUserId,
      saccoId: sacco.id,
      role,
      isActive: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        email: args.email,
        saccoCode: sacco.code,
        saccoName: sacco.name,
        role,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
