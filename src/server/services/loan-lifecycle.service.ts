import { prisma } from "@/src/server/db/prisma";
import { SettingsService } from "@/src/server/services/settings.service";
import { AuditService } from "@/src/server/services/audit.service";

const DAY_MS = 24 * 60 * 60 * 1000;

const getDaysPastDue = (dueAt: Date, asOf: Date) => {
  if (asOf.getTime() <= dueAt.getTime()) {
    return 0;
  }
  return Math.ceil((asOf.getTime() - dueAt.getTime()) / DAY_MS);
};

export const LoanLifecycleService = {
  async reconcileSacco(saccoId: string, asOf = new Date()) {
    const settings = await SettingsService.get(saccoId);
    const loans = await prisma.loan.findMany({
      where: {
        saccoId,
        status: { in: ["DISBURSED", "ACTIVE"] },
      },
      select: {
        id: true,
        saccoId: true,
        status: true,
        appliedAt: true,
      },
    });

    let movedToActive = 0;
    let movedToDefaulted = 0;

    for (const loan of loans) {
      const dueAt =
        (loan as unknown as { dueAt?: Date | null }).dueAt ?? loan.appliedAt;
      const daysPastDue = getDaysPastDue(dueAt, asOf);

      let nextStatus: "ACTIVE" | "DEFAULTED" | null = null;
      if (daysPastDue >= settings.delinquency.defaultAfterDaysPastDue) {
        nextStatus = "DEFAULTED";
      } else if (loan.status !== "ACTIVE") {
        nextStatus = "ACTIVE";
      }

      if (!nextStatus || nextStatus === loan.status) {
        continue;
      }

      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: nextStatus },
      });

      await AuditService.record({
        saccoId,
        action: "UPDATE",
        entity: "Loan",
        entityId: loan.id,
        before: { status: loan.status },
        after: { status: nextStatus, daysPastDue },
      });

      if (nextStatus === "DEFAULTED") {
        movedToDefaulted += 1;
      } else {
        movedToActive += 1;
      }
    }

    return {
      saccoId,
      scanned: loans.length,
      movedToActive,
      movedToDefaulted,
    };
  },

  async reconcileAll(asOf = new Date()) {
    const saccos = await prisma.sacco.findMany({
      select: { id: true },
    });

    const results = [];
    for (const sacco of saccos) {
      results.push(await this.reconcileSacco(sacco.id, asOf));
    }

    return {
      scannedSaccos: saccos.length,
      scannedLoans: results.reduce((sum, result) => sum + result.scanned, 0),
      movedToActive: results.reduce(
        (sum, result) => sum + result.movedToActive,
        0,
      ),
      movedToDefaulted: results.reduce(
        (sum, result) => sum + result.movedToDefaulted,
        0,
      ),
      results,
    };
  },
};
