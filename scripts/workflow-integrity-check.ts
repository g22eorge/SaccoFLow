import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shouldFix = process.argv.includes("--fix");
const EPSILON = new Prisma.Decimal("0.009");

const toDecimal = (value: Prisma.Decimal | number | null | undefined) =>
  new Prisma.Decimal(value ?? 0);

async function main() {
  const loans = await prisma.loan.findMany({
    select: {
      id: true,
      saccoId: true,
      memberId: true,
      status: true,
      approvedAt: true,
      disbursedAt: true,
      principalAmount: true,
      outstandingPrincipal: true,
      outstandingInterest: true,
      outstandingPenalty: true,
    },
  });

  const savingsByMember = await prisma.savingsTransaction.groupBy({
    by: ["saccoId", "memberId", "type"],
    _sum: { amount: true },
  });

  const sharesByMember = await prisma.ledgerEntry.groupBy({
    by: ["saccoId", "memberId", "eventType"],
    where: { eventType: { in: ["SHARE_PURCHASE", "SHARE_REDEMPTION", "SHARE_ADJUSTMENT"] } },
    _sum: { amount: true },
  });

  const external = await prisma.externalCapitalTransaction.findMany({
    select: {
      id: true,
      saccoId: true,
      status: true,
      verifiedAt: true,
      verifiedById: true,
      postedAt: true,
      postedById: true,
      baseAmount: true,
    },
  });

  const loanAnomalies: Array<Record<string, unknown>> = [];
  let fixedCleared = 0;

  for (const loan of loans) {
    const due = toDecimal(loan.outstandingPrincipal)
      .plus(loan.outstandingInterest)
      .plus(loan.outstandingPenalty);

    if (
      ["ACTIVE", "DISBURSED", "DEFAULTED"].includes(loan.status) &&
      due.lessThanOrEqualTo(EPSILON)
    ) {
      loanAnomalies.push({
        type: "loan_micro_balance_not_cleared",
        loanId: loan.id,
        status: loan.status,
        totalOutstanding: due.toString(),
      });

      if (shouldFix) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: {
            status: "CLEARED",
            outstandingPrincipal: new Prisma.Decimal(0),
            outstandingInterest: new Prisma.Decimal(0),
            outstandingPenalty: new Prisma.Decimal(0),
          },
        });
        fixedCleared += 1;
      }
    }

    if (loan.status === "CLEARED" && due.greaterThan(EPSILON)) {
      loanAnomalies.push({
        type: "loan_cleared_with_balance",
        loanId: loan.id,
        totalOutstanding: due.toString(),
      });
    }

    if (loan.status === "APPROVED" && !loan.approvedAt) {
      loanAnomalies.push({
        type: "loan_approved_missing_timestamp",
        loanId: loan.id,
      });
    }

    if (["DISBURSED", "ACTIVE", "DEFAULTED"].includes(loan.status) && !loan.disbursedAt) {
      loanAnomalies.push({
        type: "loan_disbursed_state_missing_timestamp",
        loanId: loan.id,
        status: loan.status,
      });
    }
  }

  const savingsMap = new Map<string, { deposit: Prisma.Decimal; withdrawal: Prisma.Decimal; adjustment: Prisma.Decimal }>();
  for (const row of savingsByMember) {
    const key = `${row.saccoId}:${row.memberId}`;
    const current = savingsMap.get(key) ?? {
      deposit: new Prisma.Decimal(0),
      withdrawal: new Prisma.Decimal(0),
      adjustment: new Prisma.Decimal(0),
    };
    const amount = toDecimal(row._sum.amount);
    if (row.type === "DEPOSIT") current.deposit = amount;
    if (row.type === "WITHDRAWAL") current.withdrawal = amount;
    if (row.type === "ADJUSTMENT") current.adjustment = amount;
    savingsMap.set(key, current);
  }

  const negativeSavings = [...savingsMap.entries()]
    .map(([key, value]) => {
      const balance = value.deposit.minus(value.withdrawal).plus(value.adjustment);
      return { key, balance };
    })
    .filter((item) => item.balance.lessThan(0))
    .map((item) => ({ type: "negative_savings_balance", memberKey: item.key, balance: item.balance.toString() }));

  const sharesMap = new Map<string, { purchase: Prisma.Decimal; redemption: Prisma.Decimal; adjustment: Prisma.Decimal }>();
  for (const row of sharesByMember) {
    if (!row.memberId) continue;
    const key = `${row.saccoId}:${row.memberId}`;
    const current = sharesMap.get(key) ?? {
      purchase: new Prisma.Decimal(0),
      redemption: new Prisma.Decimal(0),
      adjustment: new Prisma.Decimal(0),
    };
    const amount = toDecimal(row._sum.amount);
    if (row.eventType === "SHARE_PURCHASE") current.purchase = amount;
    if (row.eventType === "SHARE_REDEMPTION") current.redemption = amount;
    if (row.eventType === "SHARE_ADJUSTMENT") current.adjustment = amount;
    sharesMap.set(key, current);
  }

  const negativeShares = [...sharesMap.entries()]
    .map(([key, value]) => {
      const balance = value.purchase.minus(value.redemption).plus(value.adjustment);
      return { key, balance };
    })
    .filter((item) => item.balance.lessThan(0))
    .map((item) => ({ type: "negative_share_balance", memberKey: item.key, balance: item.balance.toString() }));

  const externalAnomalies = external.flatMap((tx) => {
    const issues: Array<Record<string, unknown>> = [];
    if (tx.status === "VERIFIED" && (!tx.verifiedAt || !tx.verifiedById)) {
      issues.push({ type: "external_verified_missing_metadata", id: tx.id, saccoId: tx.saccoId });
    }
    if (tx.status === "POSTED" && (!tx.postedAt || !tx.postedById)) {
      issues.push({ type: "external_posted_missing_metadata", id: tx.id, saccoId: tx.saccoId });
    }
    if (toDecimal(tx.baseAmount).lessThan(0) && tx.status === "POSTED") {
      issues.push({ type: "external_negative_posted_amount", id: tx.id, baseAmount: tx.baseAmount.toString() });
    }
    return issues;
  });

  const report = {
    scanned: {
      loans: loans.length,
      savingsMembers: savingsMap.size,
      sharesMembers: sharesMap.size,
      externalCapitalTransactions: external.length,
    },
    anomalies: {
      loans: loanAnomalies.length,
      negativeSavings: negativeSavings.length,
      negativeShares: negativeShares.length,
      externalCapital: externalAnomalies.length,
    },
    fixed: {
      loanMicroBalancesCleared: fixedCleared,
    },
    samples: {
      loans: loanAnomalies.slice(0, 20),
      negativeSavings: negativeSavings.slice(0, 20),
      negativeShares: negativeShares.slice(0, 20),
      externalCapital: externalAnomalies.slice(0, 20),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
