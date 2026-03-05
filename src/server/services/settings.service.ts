import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { AuditService } from "@/src/server/services/audit.service";
import {
  AppSettings,
  defaultSettings,
  settingsSchema,
} from "@/src/lib/settings";

const cloneDefaults = (): AppSettings =>
  settingsSchema.parse(structuredClone(defaultSettings));

const mergeWithDefaults = (value: unknown): AppSettings => {
  const defaults = cloneDefaults();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const source = value as Record<string, unknown>;
  const next = structuredClone(defaults) as Record<string, unknown>;

  for (const [sectionKey, sectionDefaults] of Object.entries(defaults)) {
    const sectionValue = source[sectionKey];
    if (
      sectionValue &&
      typeof sectionValue === "object" &&
      !Array.isArray(sectionValue) &&
      sectionDefaults &&
      typeof sectionDefaults === "object" &&
      !Array.isArray(sectionDefaults)
    ) {
      next[sectionKey] = {
        ...(sectionDefaults as Record<string, unknown>),
        ...(sectionValue as Record<string, unknown>),
      };
    }
  }

  return settingsSchema.parse(next);
};

const parseStoredSettings = (value: unknown): AppSettings => {
  const parsed = settingsSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return mergeWithDefaults(value);
};

const parseAuditJson = (value: string | null) => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const getAppSettingDelegate = () =>
  (
    prisma as unknown as {
      appSetting?: {
        findUnique: (
          args: unknown,
        ) => Promise<{ id: string; data: unknown } | null>;
        create: (args: unknown) => Promise<{ id: string; data: unknown }>;
        upsert: (args: unknown) => Promise<{ id: string; data: unknown }>;
      };
    }
  ).appSetting;

const getAppSettingRaw = async (saccoId: string) => {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; data: string }>
  >(
    'SELECT "id", "data" FROM "AppSetting" WHERE "saccoId" = ? LIMIT 1',
    saccoId,
  );
  return rows[0] ?? null;
};

export const SettingsService = {
  async get(saccoId: string) {
    const delegate = getAppSettingDelegate();
    const existing = delegate
      ? await delegate.findUnique({ where: { saccoId } })
      : await getAppSettingRaw(saccoId);

    if (!existing) {
      const defaults = cloneDefaults();
      if (delegate) {
        await delegate.create({
          data: {
            saccoId,
            data: defaults as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "AppSetting" ("id", "saccoId", "data", "createdAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          crypto.randomUUID(),
          saccoId,
          JSON.stringify(defaults),
        );
      }
      return defaults;
    }

    const data =
      typeof existing.data === "string"
        ? JSON.parse(existing.data)
        : existing.data;
    return parseStoredSettings(data);
  },

  async update(saccoId: string, payload: unknown, actorId?: string) {
    const nextSettings = settingsSchema.parse(payload);
    const before = await this.get(saccoId);
    const delegate = getAppSettingDelegate();

    const updated = delegate
      ? await delegate.upsert({
          where: { saccoId },
          update: {
            data: nextSettings as Prisma.InputJsonValue,
          },
          create: {
            saccoId,
            data: nextSettings as Prisma.InputJsonValue,
          },
        })
      : await (async () => {
          const existing = await getAppSettingRaw(saccoId);
          const id = existing?.id ?? crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            'INSERT INTO "AppSetting" ("id", "saccoId", "data", "createdAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT("saccoId") DO UPDATE SET "data" = excluded."data", "updatedAt" = CURRENT_TIMESTAMP',
            id,
            saccoId,
            JSON.stringify(nextSettings),
          );
          return { id, data: nextSettings };
        })();

    await AuditService.record({
      saccoId,
      actorId,
      action: "UPDATE",
      entity: "AppSetting",
      entityId: updated.id,
      before,
      after: nextSettings,
    });

    return nextSettings;
  },

  async listVersions(saccoId: string, take = 12) {
    const rows = await prisma.auditLog.findMany({
      where: {
        saccoId,
        entity: "AppSetting",
        action: { in: ["UPDATE", "ROLLBACK"] },
      },
      include: {
        actor: {
          select: {
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return rows.map((row) => {
      const before = parseAuditJson(row.beforeJson) as Record<string, unknown> | null;
      const after = parseAuditJson(row.afterJson) as Record<string, unknown> | null;

      let changedCount = 0;
      if (before && after) {
        const beforeFlat = JSON.stringify(before);
        const afterFlat = JSON.stringify(after);
        changedCount = beforeFlat === afterFlat ? 0 : 1;
      }

      return {
        id: row.id,
        action: row.action,
        createdAt: row.createdAt.toISOString(),
        actorName: row.actor?.fullName ?? null,
        actorEmail: row.actor?.email ?? null,
        actorRole: row.actor?.role ?? null,
        sourceVersionId:
          after && typeof after === "object" && "sourceVersionId" in after
            ? String((after as Record<string, unknown>).sourceVersionId)
            : null,
        changedCount,
      };
    });
  },

  async rollbackToVersion(saccoId: string, versionId: string, actorId?: string) {
    const version = await prisma.auditLog.findFirst({
      where: {
        id: versionId,
        saccoId,
        entity: "AppSetting",
        action: { in: ["UPDATE", "ROLLBACK"] },
      },
      select: {
        id: true,
        afterJson: true,
      },
    });

    if (!version?.afterJson) {
      throw new Error("Settings version not found");
    }

    const target = parseStoredSettings(parseAuditJson(version.afterJson));
    const before = await this.get(saccoId);
    const delegate = getAppSettingDelegate();

    const updated = delegate
      ? await delegate.upsert({
          where: { saccoId },
          update: {
            data: target as Prisma.InputJsonValue,
          },
          create: {
            saccoId,
            data: target as Prisma.InputJsonValue,
          },
        })
      : await (async () => {
          const existing = await getAppSettingRaw(saccoId);
          const id = existing?.id ?? crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            'INSERT INTO "AppSetting" ("id", "saccoId", "data", "createdAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT("saccoId") DO UPDATE SET "data" = excluded."data", "updatedAt" = CURRENT_TIMESTAMP',
            id,
            saccoId,
            JSON.stringify(target),
          );
          return { id, data: target };
        })();

    await AuditService.record({
      saccoId,
      actorId,
      action: "ROLLBACK",
      entity: "AppSetting",
      entityId: updated.id,
      before,
      after: {
        ...target,
        sourceVersionId: version.id,
      },
    });

    return target;
  },
};
