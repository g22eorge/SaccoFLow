import { prisma } from "@/src/server/db/prisma";
import { SettingsService } from "@/src/server/services/settings.service";

const balancedAutoDecision = {
  enableGreenAutoScheduleApproval: true,
  greenMinScore: 78,
  creditCapacityMultiplier: 2.5,
  creditCapacityBaseBuffer: 150000,
  minRepaymentCount: 4,
  requireAnyClearedLoan: true,
  maxAllowedOverdueOpenLoans: 0,
  defaultPenaltyPoints: 30,
  overduePenaltyPoints: 12,
  thinHistoryPenaltyPoints: 12,
  noClearedPenaltyPoints: 10,
  utilizationWarningThreshold: 0.75,
  utilizationHardStopThreshold: 1,
  utilizationWarningPenaltyPoints: 10,
  utilizationHardStopPenaltyPoints: 25,
} as const;

async function main() {
  const saccos = await prisma.sacco.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  let updated = 0;
  for (const sacco of saccos) {
    const current = await SettingsService.get(sacco.id);
    const next = {
      ...current,
      autoDecision: {
        ...current.autoDecision,
        ...balancedAutoDecision,
      },
    };

    await SettingsService.update(sacco.id, next);
    updated += 1;
    console.log(`updated ${sacco.code}`);
  }

  console.log(`done: updated ${updated} SACCO settings profiles`);
}

main()
  .catch((error) => {
    console.error("backfill failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
