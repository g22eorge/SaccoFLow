import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { SettingsService } from "@/src/server/services/settings.service";
import {
  loanProductUpdateSchema,
  loanProductUpsertSchema,
} from "@/src/server/validators/loan-products";
import { AuditService } from "@/src/server/services/audit.service";

const toDecimal = (value: number) => new Prisma.Decimal(value);

export const LoanProductsService = {
  async ensureDefault(saccoId: string) {
    const existingDefault = await prisma.loanProduct.findFirst({
      where: { saccoId, isDefault: true },
    });
    if (existingDefault) {
      return existingDefault;
    }

    const settings = await SettingsService.get(saccoId);
    const seeded = await prisma.loanProduct.create({
      data: {
        saccoId,
        name: settings.loanProduct.defaultProductName,
        minPrincipal: toDecimal(settings.loanProduct.minPrincipal),
        maxPrincipal: toDecimal(settings.loanProduct.maxPrincipal),
        minTermMonths: settings.loanProduct.minTermMonths,
        maxTermMonths: settings.loanProduct.maxTermMonths,
        repaymentFrequency: settings.loanProduct.repaymentFrequency,
        requireGuarantor: settings.loanProduct.requireGuarantor,
        requireCollateral: settings.loanProduct.requireCollateral,
        isActive: true,
        isDefault: true,
      },
    });
    return seeded;
  },

  async list(saccoId: string) {
    await this.ensureDefault(saccoId);
    return prisma.loanProduct.findMany({
      where: { saccoId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  },

  async create(saccoId: string, payload: unknown, actorId?: string) {
    const parsed = loanProductUpsertSchema.parse(payload);
    if (parsed.maxPrincipal < parsed.minPrincipal) {
      throw new Error("Max principal must be greater than or equal to min principal");
    }
    if (parsed.maxTermMonths < parsed.minTermMonths) {
      throw new Error("Max term must be greater than or equal to min term");
    }

    const created = await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.loanProduct.updateMany({
          where: { saccoId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.loanProduct.create({
        data: {
          saccoId,
          name: parsed.name.trim(),
          minPrincipal: toDecimal(parsed.minPrincipal),
          maxPrincipal: toDecimal(parsed.maxPrincipal),
          minTermMonths: parsed.minTermMonths,
          maxTermMonths: parsed.maxTermMonths,
          annualRatePercent:
            parsed.annualRatePercent !== undefined
              ? toDecimal(parsed.annualRatePercent)
              : null,
          monthlyRatePercent:
            parsed.monthlyRatePercent !== undefined
              ? toDecimal(parsed.monthlyRatePercent)
              : null,
          repaymentFrequency: parsed.repaymentFrequency,
          requireGuarantor: parsed.requireGuarantor,
          requireCollateral: parsed.requireCollateral,
          isActive: parsed.isActive,
          isDefault: parsed.isDefault,
        },
      });
    });

    await AuditService.record({
      saccoId,
      actorId,
      action: "CREATE",
      entity: "LoanProduct",
      entityId: created.id,
      after: created,
    });

    return created;
  },

  async seedStandardCatalog(saccoId: string, actorId?: string) {
    await this.ensureDefault(saccoId);

    const templates = [
      {
        name: "Emergency Loan",
        minPrincipal: 100000,
        maxPrincipal: 1000000,
        minTermMonths: 1,
        maxTermMonths: 6,
        repaymentFrequency: "MONTHLY",
        requireGuarantor: false,
        requireCollateral: false,
      },
      {
        name: "Development Loan",
        minPrincipal: 500000,
        maxPrincipal: 5000000,
        minTermMonths: 3,
        maxTermMonths: 24,
        repaymentFrequency: "MONTHLY",
        requireGuarantor: true,
        requireCollateral: false,
      },
      {
        name: "Business Expansion Loan",
        minPrincipal: 1000000,
        maxPrincipal: 15000000,
        minTermMonths: 6,
        maxTermMonths: 36,
        repaymentFrequency: "MONTHLY",
        requireGuarantor: true,
        requireCollateral: true,
      },
    ] as const;

    const seeded = [] as Array<{ id: string; name: string }>;
    for (const template of templates) {
      const row = await prisma.loanProduct.upsert({
        where: {
          saccoId_name: {
            saccoId,
            name: template.name,
          },
        },
        update: {
          minPrincipal: toDecimal(template.minPrincipal),
          maxPrincipal: toDecimal(template.maxPrincipal),
          minTermMonths: template.minTermMonths,
          maxTermMonths: template.maxTermMonths,
          annualRatePercent: null,
          monthlyRatePercent: null,
          repaymentFrequency: template.repaymentFrequency,
          requireGuarantor: template.requireGuarantor,
          requireCollateral: template.requireCollateral,
          isActive: true,
        },
        create: {
          saccoId,
          name: template.name,
          minPrincipal: toDecimal(template.minPrincipal),
          maxPrincipal: toDecimal(template.maxPrincipal),
          minTermMonths: template.minTermMonths,
          maxTermMonths: template.maxTermMonths,
          annualRatePercent: null,
          monthlyRatePercent: null,
          repaymentFrequency: template.repaymentFrequency,
          requireGuarantor: template.requireGuarantor,
          requireCollateral: template.requireCollateral,
          isActive: true,
          isDefault: false,
        },
        select: { id: true, name: true },
      });
      seeded.push(row);
    }

    await AuditService.record({
      saccoId,
      actorId,
      action: "UPSERT",
      entity: "LoanProductCatalog",
      entityId: `standard:${saccoId}`,
      after: { seeded },
    });

    return seeded;
  },

  async update(saccoId: string, id: string, payload: unknown, actorId?: string) {
    const parsed = loanProductUpdateSchema.parse(payload);
    const existing = await prisma.loanProduct.findFirst({
      where: { id, saccoId },
    });
    if (!existing) {
      throw new Error("Loan product not found");
    }

    const nextMinPrincipal =
      parsed.minPrincipal !== undefined
        ? parsed.minPrincipal
        : Number(existing.minPrincipal.toString());
    const nextMaxPrincipal =
      parsed.maxPrincipal !== undefined
        ? parsed.maxPrincipal
        : Number(existing.maxPrincipal.toString());
    const nextMinTerm =
      parsed.minTermMonths !== undefined
        ? parsed.minTermMonths
        : existing.minTermMonths;
    const nextMaxTerm =
      parsed.maxTermMonths !== undefined
        ? parsed.maxTermMonths
        : existing.maxTermMonths;

    if (nextMaxPrincipal < nextMinPrincipal) {
      throw new Error("Max principal must be greater than or equal to min principal");
    }
    if (nextMaxTerm < nextMinTerm) {
      throw new Error("Max term must be greater than or equal to min term");
    }

    if (parsed.isActive === false && existing.isDefault) {
      throw new Error("Default product cannot be deactivated");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.isDefault === true) {
        await tx.loanProduct.updateMany({
          where: { saccoId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.loanProduct.update({
        where: { id: existing.id },
        data: {
          ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
          ...(parsed.minPrincipal !== undefined
            ? { minPrincipal: toDecimal(parsed.minPrincipal) }
            : {}),
          ...(parsed.maxPrincipal !== undefined
            ? { maxPrincipal: toDecimal(parsed.maxPrincipal) }
            : {}),
          ...(parsed.minTermMonths !== undefined
            ? { minTermMonths: parsed.minTermMonths }
            : {}),
          ...(parsed.maxTermMonths !== undefined
            ? { maxTermMonths: parsed.maxTermMonths }
            : {}),
          ...(parsed.annualRatePercent !== undefined
            ? { annualRatePercent: toDecimal(parsed.annualRatePercent) }
            : {}),
          ...(parsed.monthlyRatePercent !== undefined
            ? { monthlyRatePercent: toDecimal(parsed.monthlyRatePercent) }
            : {}),
          ...(parsed.repaymentFrequency !== undefined
            ? { repaymentFrequency: parsed.repaymentFrequency }
            : {}),
          ...(parsed.requireGuarantor !== undefined
            ? { requireGuarantor: parsed.requireGuarantor }
            : {}),
          ...(parsed.requireCollateral !== undefined
            ? { requireCollateral: parsed.requireCollateral }
            : {}),
          ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
          ...(parsed.isDefault !== undefined ? { isDefault: parsed.isDefault } : {}),
        },
      });
    });

    await AuditService.record({
      saccoId,
      actorId,
      action: "UPDATE",
      entity: "LoanProduct",
      entityId: existing.id,
      before: existing,
      after: updated,
    });

    return updated;
  },
};
