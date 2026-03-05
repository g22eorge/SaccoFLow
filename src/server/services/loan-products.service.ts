import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { SettingsService } from "@/src/server/services/settings.service";
import { loanProductUpsertSchema } from "@/src/server/validators/loan-products";
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
};
