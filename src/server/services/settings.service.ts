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
};
