import { z } from "zod";
import { created, fail, withApiHandler } from "@/src/server/api/http";
import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/prisma";
import { BillingService } from "@/src/server/services/billing.service";
import { SettingsService } from "@/src/server/services/settings.service";

const schema = z.object({
  organizationName: z.string().min(2).max(120),
  organizationCode: z.string().min(2).max(40),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPhone: z.string().min(7).max(24).optional(),
  password: z.string().min(8).max(128),
  timezone: z.string().min(2).max(80).default("Africa/Kampala"),
  locale: z.string().min(2).max(20).default("en-UG"),
});

const normalizeCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const ensureAuthUser = async (input: {
  email: string;
  password: string;
  name: string;
}) => {
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(input.email);

  if (existing?.user?.id) {
    throw new Error("Admin email is already registered");
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

  return user.id;
};

export const POST = withApiHandler(async (request: Request) => {
  const parsed = schema.parse(await request.json());
  const saccoCode = normalizeCode(parsed.organizationCode);

  if (!saccoCode) {
    return fail("Organization code is invalid", 400, "INVALID_ORG_CODE");
  }

  const existingSacco = await prisma.sacco.findUnique({
    where: { code: saccoCode },
    select: { id: true },
  });
  if (existingSacco) {
    return fail(
      "Organization code already exists. Use a different code.",
      409,
      "ORG_CODE_EXISTS",
    );
  }

  const email = parsed.adminEmail.toLowerCase();
  const userId = await ensureAuthUser({
    email,
    password: parsed.password,
    name: parsed.adminName,
  });

  const sacco = await prisma.sacco.create({
    data: {
      code: saccoCode,
      name: parsed.organizationName.trim(),
    },
  });

  const appUser = await prisma.appUser.create({
    data: {
      authUserId: userId,
      email,
      fullName: parsed.adminName.trim(),
      phone: parsed.adminPhone?.trim() || null,
      role: "SUPER_ADMIN",
      saccoId: sacco.id,
      timezone: parsed.timezone,
      locale: parsed.locale,
      isActive: true,
    },
  });

  await prisma.appUserTenantAccess.create({
    data: {
      authUserId: userId,
      saccoId: sacco.id,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  await BillingService.getOrCreateSubscription(sacco.id);

  const currentSettings = await SettingsService.get(sacco.id);
  await SettingsService.update(
    sacco.id,
    {
      ...currentSettings,
      saccoProfile: {
        ...currentSettings.saccoProfile,
        organizationName: parsed.organizationName.trim(),
        organizationCode: saccoCode,
        timezone: parsed.timezone,
        locale: parsed.locale,
      },
      notifications: {
        ...currentSettings.notifications,
        escalationEmail: email,
      },
    },
    appUser.id,
  );

  return created({
    saccoId: sacco.id,
    saccoCode: sacco.code,
    saccoName: sacco.name,
    adminEmail: email,
    signInUrl: "/sign-in",
  });
});
