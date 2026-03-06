import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/src/server/api/http";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";

const updateSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional().nullable(),
  jobTitle: z.string().max(80).optional().nullable(),
  branch: z.string().max(80).optional().nullable(),
  timezone: z.string().max(80).optional().nullable(),
  locale: z.string().max(40).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyRepaymentReminderDays: z.coerce.number().int().min(0).max(30).optional(),
});

export const GET = withApiHandler(async () => {
  const { id: actorId, saccoId } = await requireSaccoContext();

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
    throw new Error("Profile not found");
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

  return ok({
    ...profile,
    sessions: sessions.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      expiresAt: entry.expiresAt.toISOString(),
    })),
  });
});

export const PATCH = withApiHandler(async (request: NextRequest) => {
  const { id: actorId, saccoId } = await requireSaccoContext();
  const payload = updateSchema.parse(await request.json());

  const before = await prisma.appUser.findFirst({
    where: { id: actorId, saccoId, isActive: true },
  });
  if (!before) {
    throw new Error("Profile not found");
  }

  const updated = await prisma.appUser.update({
    where: { id: actorId },
    data: {
      ...(payload.fullName !== undefined ? { fullName: payload.fullName.trim() } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
      ...(payload.jobTitle !== undefined
        ? { jobTitle: payload.jobTitle?.trim() || null }
        : {}),
      ...(payload.branch !== undefined ? { branch: payload.branch?.trim() || null } : {}),
      ...(payload.timezone !== undefined
        ? { timezone: payload.timezone?.trim() || null }
        : {}),
      ...(payload.locale !== undefined ? { locale: payload.locale?.trim() || null } : {}),
      ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl || null } : {}),
      ...(payload.notifyEmail !== undefined ? { notifyEmail: payload.notifyEmail } : {}),
      ...(payload.notifySms !== undefined ? { notifySms: payload.notifySms } : {}),
      ...(payload.notifyWhatsapp !== undefined
        ? { notifyWhatsapp: payload.notifyWhatsapp }
        : {}),
      ...(payload.notifyRepaymentReminderDays !== undefined
        ? { notifyRepaymentReminderDays: payload.notifyRepaymentReminderDays }
        : {}),
    },
  });

  if (payload.fullName !== undefined) {
    await prisma.user.update({
      where: { id: before.authUserId },
      data: { name: payload.fullName.trim() },
    });
  }

  if (payload.avatarUrl !== undefined) {
    await prisma.user.update({
      where: { id: before.authUserId },
      data: { image: payload.avatarUrl || null },
    });
  }

  await AuditService.record({
    saccoId,
    actorId,
    action: "UPDATE",
    entity: "AccountProfile",
    entityId: actorId,
    before,
    after: updated,
  });

  return ok(updated);
});
