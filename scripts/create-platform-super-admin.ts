import { prisma } from "@/src/server/db/prisma";
import { auth } from "@/src/server/auth/auth";
import { Role } from "@prisma/client";

type CliOptions = {
  email?: string;
  password?: string;
  name?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if ((current === "--email" || current === "-e") && next) {
      options.email = next;
      index += 1;
    } else if ((current === "--password" || current === "-p") && next) {
      options.password = next;
      index += 1;
    } else if ((current === "--name" || current === "-n") && next) {
      options.name = next;
      index += 1;
    }
  }

  return options;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  bun run admin:create-platform-super -- --email tech@example.com --password 'StrongPass123!'",
      "Optional:",
      "  --name 'Platform Super Admin'",
    ].join("\n"),
  );
}

async function ensureAuthUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(input.email);

  if (existing?.user?.id) {
    return { userId: existing.user.id, created: false };
  }

  const hash = await context.password.hash(input.password);
  const user = await context.internalAdapter.createUser({
    email: input.email,
    name: input.name,
    emailVerified: true,
  });

  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  return { userId: user.id, created: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.toLowerCase() ?? process.env.PLATFORM_SUPER_ADMIN_EMAIL?.toLowerCase();
  const password = args.password ?? process.env.PLATFORM_SUPER_ADMIN_PASSWORD;
  const name = args.name ?? process.env.PLATFORM_SUPER_ADMIN_NAME ?? "Platform Super Admin";

  if (!email || !password) {
    usage();
    process.exit(1);
  }

  const { userId, created } = await ensureAuthUser({ email, password, name });

  await prisma.appUser.upsert({
    where: { authUserId: userId },
    update: {
      email,
      fullName: name,
      role: Role.PLATFORM_SUPER_ADMIN,
      saccoId: null,
      isActive: true,
    },
    create: {
      authUserId: userId,
      email,
      fullName: name,
      role: Role.PLATFORM_SUPER_ADMIN,
      saccoId: null,
      isActive: true,
    },
  });

  console.log(
    [
      "Platform super admin is ready.",
      `email=${email}`,
      `password=${password}`,
      `authUserCreated=${created}`,
      "saccoCode=<none>",
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error("Failed to create platform super admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
