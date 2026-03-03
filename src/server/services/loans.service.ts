import { LoanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import {
  loanApplicationSchema,
  loanRepaymentSchema,
} from "@/src/server/validators/loans";
import { LedgerService } from "@/src/server/services/ledger.service";
import { AuditService } from "@/src/server/services/audit.service";
import { SettingsService } from "@/src/server/services/settings.service";

type AllocationTarget = "PENALTY" | "INTEREST" | "PRINCIPAL";

const DAY_MS = 24 * 60 * 60 * 1000;

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const decimal = (value: Prisma.Decimal | number | undefined) =>
  new Prisma.Decimal(value ?? 0);

const minDecimal = (a: Prisma.Decimal, b: Prisma.Decimal) =>
  a.lessThan(b) ? a : b;

const getInterestAmount = (
  principal: Prisma.Decimal,
  termMonths: number,
  annualRatePercent: number,
  monthlyRatePercent: number,
) => {
  if (monthlyRatePercent > 0) {
    return principal.mul(monthlyRatePercent).div(100).mul(termMonths);
  }

  return principal.mul(annualRatePercent).div(100).mul(termMonths).div(12);
};

const frequencyDays: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
};

const uniqueAllocationOrder = (targets: AllocationTarget[]) => {
  const order: AllocationTarget[] = [];
  for (const target of targets) {
    if (!order.includes(target)) {
      order.push(target);
    }
  }
  for (const target of [
    "PENALTY",
    "INTEREST",
    "PRINCIPAL",
  ] as AllocationTarget[]) {
    if (!order.includes(target)) {
      order.push(target);
    }
  }
  return order;
};

export const LoansService = {
  async list(input: { saccoId: string; status?: string }) {
    return prisma.loan.findMany({
      where: {
        saccoId: input.saccoId,
        ...(input.status ? { status: input.status as LoanStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async apply(payload: unknown, actorId?: string) {
    const parsed = loanApplicationSchema.parse(payload);
    const principalAmount = new Prisma.Decimal(parsed.principalAmount);
    const settings = await SettingsService.get(parsed.saccoId);

    if (principalAmount.lessThan(settings.loanProduct.minPrincipal)) {
      throw new Error("Principal is below configured minimum loan amount");
    }
    if (principalAmount.greaterThan(settings.loanProduct.maxPrincipal)) {
      throw new Error("Principal exceeds configured maximum loan amount");
    }

    const termMonths = parsed.termMonths ?? settings.loanProduct.minTermMonths;
    if (termMonths < settings.loanProduct.minTermMonths) {
      throw new Error("Loan term is below configured minimum term");
    }
    if (termMonths > settings.loanProduct.maxTermMonths) {
      throw new Error("Loan term exceeds configured maximum term");
    }

    const interestAmount = getInterestAmount(
      principalAmount,
      termMonths,
      settings.interest.annualRatePercent,
      settings.interest.monthlyRatePercent,
    );
    const dueAt = addMonths(new Date(), termMonths);

    const loan = await prisma.loan.create({
      data: {
        saccoId: parsed.saccoId,
        memberId: parsed.memberId,
        termMonths,
        dueAt,
        principalAmount,
        interestAmount,
        outstandingPrincipal: principalAmount,
        outstandingInterest: interestAmount,
        outstandingPenalty: new Prisma.Decimal(0),
      },
    });

    await LedgerService.record({
      saccoId: parsed.saccoId,
      memberId: parsed.memberId,
      eventType: "LOAN_APPLIED",
      amount: principalAmount,
      reference: loan.id,
    });

    await AuditService.record({
      saccoId: parsed.saccoId,
      actorId,
      action: "CREATE",
      entity: "Loan",
      entityId: loan.id,
      after: loan,
    });

    return loan;
  },

  async approve(id: string, saccoId: string, actorId?: string) {
    const existing = await prisma.loan.findFirstOrThrow({
      where: { id, saccoId },
    });
    if (existing.status !== "PENDING") {
      throw new Error("Only pending loans can be approved");
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
    await AuditService.record({
      saccoId,
      actorId,
      action: "UPDATE",
      entity: "Loan",
      entityId: id,
      before: existing,
      after: loan,
    });
    return loan;
  },

  async disburse(id: string, saccoId: string, actorId?: string) {
    const existing = await prisma.loan.findFirstOrThrow({
      where: { id, saccoId },
    });
    if (existing.status !== "APPROVED") {
      throw new Error("Only approved loans can be disbursed");
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        status: "DISBURSED",
        disbursedAt: new Date(),
      },
    });

    await LedgerService.record({
      saccoId: loan.saccoId,
      memberId: loan.memberId,
      eventType: "LOAN_DISBURSED",
      amount: loan.principalAmount,
      reference: loan.id,
    });

    await AuditService.record({
      saccoId,
      actorId,
      action: "UPDATE",
      entity: "Loan",
      entityId: id,
      before: existing,
      after: loan,
    });

    return loan;
  },

  async repay(id: string, payload: unknown, actorId?: string) {
    const parsed = loanRepaymentSchema.parse(payload);
    const amount = new Prisma.Decimal(parsed.amount);
    const settings = await SettingsService.get(parsed.saccoId);
    const loan = await prisma.loan.findFirstOrThrow({
      where: { id, saccoId: parsed.saccoId },
    });

    if (!["ACTIVE", "DISBURSED"].includes(loan.status)) {
      throw new Error("Loan must be disbursed/active before repayment");
    }

    if (loan.memberId !== parsed.memberId) {
      throw new Error("Repayment member does not match loan member");
    }

    const now = new Date();
    const dueAt = loan.dueAt ?? addMonths(loan.appliedAt, loan.termMonths);
    const graceBoundary = new Date(dueAt);
    graceBoundary.setDate(
      graceBoundary.getDate() + settings.delinquency.gracePeriodDays,
    );

    let penaltyIncrement = new Prisma.Decimal(0);
    if (now.getTime() > graceBoundary.getTime()) {
      const daysPastGrace = Math.ceil(
        (now.getTime() - graceBoundary.getTime()) / DAY_MS,
      );
      const lateFeeBase =
        settings.delinquency.lateFeeType === "FLAT"
          ? new Prisma.Decimal(settings.delinquency.lateFeeValue)
          : loan.outstandingPrincipal
              .mul(settings.delinquency.lateFeeValue)
              .div(100);
      const periodLengthDays =
        frequencyDays[settings.delinquency.penaltyFrequency] ?? 30;
      const periods = Math.max(1, Math.ceil(daysPastGrace / periodLengthDays));
      const penaltyRatePart = loan.outstandingPrincipal
        .mul(settings.delinquency.penaltyRatePercent)
        .div(100)
        .mul(periods);
      const cap = loan.principalAmount
        .mul(settings.delinquency.penaltyCapPercent)
        .div(100);
      const currentPenalty = decimal(loan.outstandingPenalty);
      const allowed = cap.minus(currentPenalty);
      if (allowed.greaterThan(0)) {
        penaltyIncrement = minDecimal(
          lateFeeBase.plus(penaltyRatePart),
          allowed,
        );
      }
    }

    const penaltyDue = decimal(loan.outstandingPenalty).plus(penaltyIncrement);
    const interestDue = decimal(loan.outstandingInterest);
    const principalDue = decimal(loan.outstandingPrincipal);
    const totalDue = penaltyDue.plus(interestDue).plus(principalDue);

    if (totalDue.equals(0)) {
      throw new Error("Loan has no outstanding balance");
    }
    if (amount.greaterThan(totalDue)) {
      if (
        settings.repaymentAllocation.overpaymentHandling === "HOLD_AS_CREDIT"
      ) {
        throw new Error(
          "Repayment exceeds due amount. Record excess as member savings credit.",
        );
      }
      if (settings.repaymentAllocation.overpaymentHandling === "REFUND") {
        throw new Error(
          "Repayment exceeds due amount. Refund excess before recording repayment.",
        );
      }
      throw new Error("Repayment exceeds due amount");
    }

    const order = uniqueAllocationOrder([
      settings.repaymentAllocation.primaryTarget as AllocationTarget,
      settings.repaymentAllocation.secondaryTarget as AllocationTarget,
      settings.repaymentAllocation.tertiaryTarget as AllocationTarget,
    ]);

    const buckets: Record<AllocationTarget, Prisma.Decimal> = {
      PENALTY: penaltyDue,
      INTEREST: interestDue,
      PRINCIPAL: principalDue,
    };
    const allocations: Record<AllocationTarget, Prisma.Decimal> = {
      PENALTY: decimal(0),
      INTEREST: decimal(0),
      PRINCIPAL: decimal(0),
    };
    let remaining = amount;
    for (const target of order) {
      const pay = minDecimal(remaining, buckets[target]);
      buckets[target] = buckets[target].minus(pay);
      allocations[target] = allocations[target].plus(pay);
      remaining = remaining.minus(pay);
    }

    if (remaining.greaterThan(0)) {
      throw new Error("Repayment exceeds due amount");
    }

    const nextOutstandingPenalty = buckets.PENALTY;
    const nextOutstandingInterest = buckets.INTEREST;
    const nextOutstandingPrincipal = buckets.PRINCIPAL;
    const daysPastDue = Math.max(
      0,
      Math.ceil((now.getTime() - dueAt.getTime()) / DAY_MS),
    );
    const fullyCleared = nextOutstandingPrincipal
      .plus(nextOutstandingInterest)
      .plus(nextOutstandingPenalty)
      .equals(0);
    const nextStatus = fullyCleared
      ? "CLEARED"
      : daysPastDue >= settings.delinquency.defaultAfterDaysPastDue
        ? "DEFAULTED"
        : "ACTIVE";

    return prisma.$transaction(async (tx) => {
      const repayment = await tx.loanRepayment.create({
        data: {
          saccoId: parsed.saccoId,
          loanId: id,
          memberId: parsed.memberId,
          amount,
          note: parsed.note,
        },
      });

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          outstandingPrincipal: nextOutstandingPrincipal,
          outstandingInterest: nextOutstandingInterest,
          outstandingPenalty: nextOutstandingPenalty,
          status: nextStatus,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          saccoId: parsed.saccoId,
          memberId: parsed.memberId,
          eventType: "LOAN_REPAYMENT",
          amount,
          reference: repayment.id,
        },
      });

      await tx.auditLog.create({
        data: {
          saccoId: parsed.saccoId,
          actorId,
          action: "CREATE",
          entity: "LoanRepayment",
          entityId: repayment.id,
          beforeJson: JSON.stringify({
            loanId: loan.id,
            previousOutstandingPrincipal: loan.outstandingPrincipal.toString(),
            previousOutstandingInterest: loan.outstandingInterest.toString(),
            previousOutstandingPenalty: loan.outstandingPenalty.toString(),
          }),
          afterJson: JSON.stringify({
            loanId: loan.id,
            amount: amount.toString(),
            allocatedPenalty: allocations.PENALTY.toString(),
            allocatedInterest: allocations.INTEREST.toString(),
            allocatedPrincipal: allocations.PRINCIPAL.toString(),
            penaltyIncrement: penaltyIncrement.toString(),
            outstandingPrincipal: nextOutstandingPrincipal.toString(),
            outstandingInterest: nextOutstandingInterest.toString(),
            outstandingPenalty: nextOutstandingPenalty.toString(),
            status: nextStatus,
          }),
        },
      });

      return repayment;
    });
  },
};
