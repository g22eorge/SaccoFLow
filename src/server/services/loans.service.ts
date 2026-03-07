import { LoanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import {
  loanApplicationSchema,
  loanRepaymentSchema,
} from "@/src/server/validators/loans";
import { LedgerService } from "@/src/server/services/ledger.service";
import { AuditService } from "@/src/server/services/audit.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { LoanProductsService } from "@/src/server/services/loan-products.service";
import { DashboardService } from "@/src/server/services/dashboard.service";

type AllocationTarget = "PENALTY" | "INTEREST" | "PRINCIPAL";

type ApprovalStep = {
  actorId: string;
  actorRole: string;
  decidedAtIso: string;
};

type ApprovalMatrixState = {
  loanId: string;
  requiredApproverCount: number;
  requiredRoleGroups: Array<"CREDIT" | "FINANCE">;
  approvals: ApprovalStep[];
  completed: boolean;
  riskTier: "GREEN" | "AMBER" | "RED";
  slaDueAtIso: string;
  startedAtIso: string;
  completedAtIso: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const decimal = (value: Prisma.Decimal | number | null | undefined) =>
  new Prisma.Decimal(value ?? 0);

const money = (value: Prisma.Decimal | number | null | undefined) =>
  decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

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

const toInstallmentRows = (loan: {
  id: string;
  appliedAt: Date;
  termMonths: number;
  principalAmount: Prisma.Decimal;
  interestAmount: Prisma.Decimal;
}) => {
  const termMonths = Math.max(1, loan.termMonths);
  const principalPerInstallment = loan.principalAmount.div(termMonths);
  const interestPerInstallment = loan.interestAmount.div(termMonths);

  return Array.from({ length: termMonths }, (_, index) => {
    const installmentNumber = index + 1;
    const dueAt = addMonths(loan.appliedAt, installmentNumber);
    const principal = principalPerInstallment.toFixed(2);
    const interest = interestPerInstallment.toFixed(2);
    const total = principalPerInstallment.plus(interestPerInstallment).toFixed(2);

    return {
      installmentNumber,
      dueAt: dueAt.toISOString(),
      principal,
      interest,
      total,
    };
  });
};

const assessAutoScheduleEligibility = async (input: {
  saccoId: string;
  memberId: string;
  principalAmount: Prisma.Decimal;
}) => {
  const settings = await SettingsService.get(input.saccoId);
  const auto = settings.autoDecision;
  const now = new Date();

  const [loanStatusBuckets, overdueOpenCount, repaymentCount, loanLifecycleCount, savingsDepositCount, deposits, withdrawals, adjustments, sharePurchases, shareRedemptions, shareAdjustments] =
    await Promise.all([
      prisma.loan.groupBy({
        by: ["status"],
        where: { saccoId: input.saccoId, memberId: input.memberId },
        _count: { _all: true },
      }),
      prisma.loan.count({
        where: {
          saccoId: input.saccoId,
          memberId: input.memberId,
          status: { in: ["ACTIVE", "DISBURSED", "DEFAULTED"] },
          dueAt: { lt: now },
        },
      }),
      prisma.loanRepayment.count({
        where: {
          saccoId: input.saccoId,
          memberId: input.memberId,
        },
      }),
      prisma.loan.count({
        where: {
          saccoId: input.saccoId,
          memberId: input.memberId,
          status: { in: ["DISBURSED", "ACTIVE", "CLEARED", "DEFAULTED"] },
        },
      }),
      prisma.savingsTransaction.count({
        where: {
          saccoId: input.saccoId,
          memberId: input.memberId,
          type: "DEPOSIT",
        },
      }),
      prisma.savingsTransaction.aggregate({
        where: { saccoId: input.saccoId, memberId: input.memberId, type: "DEPOSIT" },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: { saccoId: input.saccoId, memberId: input.memberId, type: "WITHDRAWAL" },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: { saccoId: input.saccoId, memberId: input.memberId, type: "ADJUSTMENT" },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { saccoId: input.saccoId, memberId: input.memberId, eventType: "SHARE_PURCHASE" },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { saccoId: input.saccoId, memberId: input.memberId, eventType: "SHARE_REDEMPTION" },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { saccoId: input.saccoId, memberId: input.memberId, eventType: "SHARE_ADJUSTMENT" },
        _sum: { amount: true },
      }),
    ]);

  const statusMap = new Map(
    loanStatusBuckets.map((bucket) => [bucket.status, bucket._count._all]),
  );
  const defaultedCount = statusMap.get("DEFAULTED") ?? 0;
  const clearedCount = statusMap.get("CLEARED") ?? 0;

  const savingsBalance = decimal(deposits._sum.amount)
    .minus(decimal(withdrawals._sum.amount))
    .plus(decimal(adjustments._sum.amount));
  const shareBalance = decimal(sharePurchases._sum.amount)
    .minus(decimal(shareRedemptions._sum.amount))
    .plus(decimal(shareAdjustments._sum.amount));

  const securedSavings = savingsBalance
    .mul(auto.savingsSecurityPercent)
    .div(100);
  const securedShares = shareBalance
    .mul(auto.sharesSecurityPercent)
    .div(100);
  const collateralBase = Prisma.Decimal.max(new Prisma.Decimal(0), securedSavings.plus(securedShares));
  const maxSupportedAmount = collateralBase
    .mul(auto.creditCapacityMultiplier)
    .plus(new Prisma.Decimal(auto.creditCapacityBaseBuffer));

  const hasEnoughRepaymentHistory = repaymentCount >= auto.minRepaymentCount;
  const hasClearedLoan = clearedCount > 0;
  const hasSavingsTrust = savingsDepositCount >= auto.minSavingsDepositCount;
  const hasLendingTrust = loanLifecycleCount >= auto.minLoanLifecycleCount;
  const hasBaselineHistory = hasEnoughRepaymentHistory || hasClearedLoan;
  const trustMaturityPassed = hasSavingsTrust && hasLendingTrust && hasEnoughRepaymentHistory;
  const onSchedule =
    defaultedCount === 0 &&
    overdueOpenCount <= auto.maxAllowedOverdueOpenLoans &&
    hasBaselineHistory &&
    (!auto.requireAnyClearedLoan || hasClearedLoan);
  const creditWorthy = input.principalAmount.lessThanOrEqualTo(maxSupportedAmount);
  const requestedAmount = input.principalAmount;
  const utilizationRatio = maxSupportedAmount.greaterThan(0)
    ? Number(requestedAmount.div(maxSupportedAmount).toFixed(4))
    : Number.POSITIVE_INFINITY;

  let score = 100;
  if (defaultedCount > 0) {
    score -= Math.min(60, defaultedCount * auto.defaultPenaltyPoints);
  }
  if (overdueOpenCount > 0) {
    score -= Math.min(35, overdueOpenCount * auto.overduePenaltyPoints);
  }
  if (!hasEnoughRepaymentHistory) {
    score -= auto.thinHistoryPenaltyPoints;
  }
  if (auto.requireAnyClearedLoan && !hasClearedLoan) {
    score -= auto.noClearedPenaltyPoints;
  }
  if (utilizationRatio > auto.utilizationHardStopThreshold * 1.2) {
    score -= auto.utilizationHardStopPenaltyPoints + 15;
  } else if (utilizationRatio > auto.utilizationHardStopThreshold) {
    score -= auto.utilizationHardStopPenaltyPoints;
  } else if (utilizationRatio > auto.utilizationWarningThreshold) {
    score -= auto.utilizationWarningPenaltyPoints;
  }

  score = Math.max(0, Math.min(100, score));

  const reasonCodes: string[] = [];
  if (defaultedCount === 0) {
    reasonCodes.push("NO_DEFAULT_HISTORY");
  } else {
    reasonCodes.push("HAS_DEFAULT_HISTORY");
  }
  if (overdueOpenCount === 0) {
    reasonCodes.push("NO_OVERDUE_OPEN_LOANS");
  } else {
    reasonCodes.push("HAS_OVERDUE_OPEN_LOANS");
  }
  if (hasEnoughRepaymentHistory) {
    reasonCodes.push("CONSISTENT_REPAYMENT_ACTIVITY");
  } else {
    reasonCodes.push("LIMITED_REPAYMENT_HISTORY");
  }
  if (hasSavingsTrust) {
    reasonCodes.push("SAVINGS_ACTIVITY_TRUST_PASSED");
  } else {
    reasonCodes.push("SAVINGS_ACTIVITY_TRUST_PENDING");
  }
  if (hasLendingTrust) {
    reasonCodes.push("LENDING_ACTIVITY_TRUST_PASSED");
  } else {
    reasonCodes.push("LENDING_ACTIVITY_TRUST_PENDING");
  }
  if (hasClearedLoan) {
    reasonCodes.push("HAS_CLEARED_LOAN_HISTORY");
  } else {
    reasonCodes.push("NO_CLEARED_LOAN_HISTORY");
  }
  if (creditWorthy) {
    reasonCodes.push("REQUEST_WITHIN_CREDIT_CAPACITY");
  } else {
    reasonCodes.push("REQUEST_EXCEEDS_CREDIT_CAPACITY");
  }

  const amberFloor = Math.max(0, auto.greenMinScore - 20);
  const riskTier = score >= auto.greenMinScore ? "GREEN" : score >= amberFloor ? "AMBER" : "RED";
  const green =
    auto.enableGreenAutoScheduleApproval &&
    riskTier === "GREEN" &&
    trustMaturityPassed &&
    onSchedule &&
    creditWorthy;

  return {
    green,
    riskTier,
    score,
    onSchedule,
    trustMaturityPassed,
    hasSavingsTrust,
    hasLendingTrust,
    creditWorthy,
    requestedAmount: requestedAmount.toFixed(2),
    maxSupportedAmount: maxSupportedAmount.toFixed(2),
    utilizationRatio,
    defaultedCount,
    overdueOpenCount,
    repaymentCount,
    reasonCodes,
  };
};

const roleInGroup = (
  role: string,
  group: "CREDIT" | "FINANCE",
) => {
  if (group === "CREDIT") {
    return ["LOAN_OFFICER", "SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(role);
  }
  return ["TREASURER", "SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(role);
};

const parseApprovalMatrixState = (raw: string | null): ApprovalMatrixState | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ApprovalMatrixState;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.approvals)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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
  async listPaged(input: {
    saccoId: string;
    status?: string;
    page?: number;
    query?: string;
    sortBy?: "dueSoon" | "outstanding" | "name";
  }) {
    const pageSize = 30;
    const page = Math.max(input.page ?? 1, 1);
    const skip = (page - 1) * pageSize;
    const normalizedQuery = input.query?.trim() ?? "";

    const where: Prisma.LoanWhereInput = {
      saccoId: input.saccoId,
      ...(input.status ? { status: input.status as LoanStatus } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              { member: { fullName: { contains: normalizedQuery } } },
              { member: { memberNumber: { contains: normalizedQuery } } },
            ],
          }
        : {}),
    };

    const sortBy = input.sortBy ?? "dueSoon";
    const orderBy: Prisma.LoanOrderByWithRelationInput[] =
      sortBy === "name"
        ? [{ member: { fullName: "asc" } }, { createdAt: "desc" }, { id: "desc" }]
        : sortBy === "outstanding"
          ? [
              { outstandingPrincipal: "desc" },
              { outstandingInterest: "desc" },
              { outstandingPenalty: "desc" },
              { id: "desc" },
            ]
          : [{ dueAt: "asc" }, { createdAt: "desc" }, { id: "desc" }];

    const [rows, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          loanProduct: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        take: pageSize,
        skip,
      }),
      prisma.loan.count({ where }),
    ]);

    return {
      rows,
      total,
      page,
      pageSize,
      hasNextPage: skip + rows.length < total,
    };
  },

  async list(input: { saccoId: string; status?: string; page?: number }) {
    const pageSize = 30;
    const page = Math.max(input.page ?? 1, 1);
    const skip = (page - 1) * pageSize;
    return prisma.loan.findMany({
      where: {
        saccoId: input.saccoId,
        ...(input.status ? { status: input.status as LoanStatus } : {}),
      },
      include: {
        loanProduct: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize,
      skip,
    });
  },

  async apply(payload: unknown, actorId?: string) {
    const parsed = loanApplicationSchema.parse(payload);
    const principalAmount = new Prisma.Decimal(parsed.principalAmount);
    const settings = await SettingsService.get(parsed.saccoId);

    const defaultProduct = await LoanProductsService.ensureDefault(parsed.saccoId);
    const loanProduct = parsed.loanProductId
      ? await prisma.loanProduct.findFirst({
          where: {
            id: parsed.loanProductId,
            saccoId: parsed.saccoId,
            isActive: true,
          },
        })
      : defaultProduct;

    if (!loanProduct) {
      throw new Error("Loan product not found or inactive");
    }

    if (principalAmount.lessThan(loanProduct.minPrincipal)) {
      throw new Error("Principal is below configured minimum loan amount");
    }
    if (principalAmount.greaterThan(loanProduct.maxPrincipal)) {
      throw new Error("Principal exceeds configured maximum loan amount");
    }

    const termMonths = parsed.termMonths ?? loanProduct.minTermMonths;
    if (termMonths < loanProduct.minTermMonths) {
      throw new Error("Loan term is below configured minimum term");
    }
    if (termMonths > loanProduct.maxTermMonths) {
      throw new Error("Loan term exceeds configured maximum term");
    }

    const interestAmount = getInterestAmount(
      principalAmount,
      termMonths,
      loanProduct.annualRatePercent !== null
        ? Number(loanProduct.annualRatePercent.toString())
        : settings.interest.annualRatePercent,
      loanProduct.monthlyRatePercent !== null
        ? Number(loanProduct.monthlyRatePercent.toString())
        : settings.interest.monthlyRatePercent,
    );
    const dueAt = addMonths(new Date(), termMonths);

    const loan = await prisma.loan.create({
      data: {
        saccoId: parsed.saccoId,
        memberId: parsed.memberId,
        loanProductId: loanProduct.id,
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

    DashboardService.invalidateCache(parsed.saccoId);

    return loan;
  },

  async approve(id: string, saccoId: string, actorId?: string) {
    const existing = await prisma.loan.findFirstOrThrow({
      where: { id, saccoId },
    });
    if (existing.status !== "PENDING") {
      throw new Error("Only pending loans can be approved");
    }

    if (!actorId) {
      throw new Error("Missing approver context");
    }

    const [settings, actor] = await Promise.all([
      SettingsService.get(saccoId),
      prisma.appUser.findFirst({
        where: { id: actorId, saccoId, isActive: true },
        select: { id: true, role: true },
      }),
    ]);

    if (!actor) {
      throw new Error("Approver account not found");
    }

    const assessment = await assessAutoScheduleEligibility({
      saccoId,
      memberId: existing.memberId,
      principalAmount: existing.principalAmount,
    });

    const requiresDualControl =
      Number(existing.principalAmount.toString()) >= settings.approvalWorkflow.loanApprovalThreshold ||
      assessment.riskTier !== "GREEN";

    const requiredApproverCount = Math.max(
      requiresDualControl ? 2 : 1,
      settings.approvalWorkflow.requiredApproverCount,
    );

    const requiredRoleGroups: Array<"CREDIT" | "FINANCE"> = requiresDualControl
      ? ["CREDIT", "FINANCE"]
      : ["CREDIT"];

    const matrixLog = await prisma.auditLog.findFirst({
      where: {
        saccoId,
        entity: "LoanApprovalMatrixState",
        entityId: id,
      },
      orderBy: { createdAt: "desc" },
    });

    const baseState: ApprovalMatrixState =
      parseApprovalMatrixState(matrixLog?.afterJson ?? null) ?? {
        loanId: id,
        requiredApproverCount,
        requiredRoleGroups,
        approvals: [],
        completed: false,
        riskTier: assessment.riskTier as "GREEN" | "AMBER" | "RED",
        slaDueAtIso: new Date(
          Date.now() + settings.approvalWorkflow.approvalSlaHours * 60 * 60 * 1000,
        ).toISOString(),
        startedAtIso: new Date().toISOString(),
        completedAtIso: null,
      };

    if (!requiredRoleGroups.some((group) => roleInGroup(actor.role, group))) {
      throw new Error("Approver role is not eligible for this approval matrix");
    }

    const alreadyApproved = baseState.approvals.some((step) => step.actorId === actor.id);
    const nextApprovals = alreadyApproved
      ? baseState.approvals
      : [
          ...baseState.approvals,
          {
            actorId: actor.id,
            actorRole: actor.role,
            decidedAtIso: new Date().toISOString(),
          },
        ];

    const roleGroupCoverage = requiredRoleGroups.every((group) =>
      nextApprovals.some((step) => roleInGroup(step.actorRole, group)),
    );
    const countCoverage = nextApprovals.length >= requiredApproverCount;
    const completed = roleGroupCoverage && countCoverage;

    const nextState: ApprovalMatrixState = {
      ...baseState,
      requiredApproverCount,
      requiredRoleGroups,
      approvals: nextApprovals,
      completed,
      completedAtIso: completed ? new Date().toISOString() : null,
      riskTier: assessment.riskTier as "GREEN" | "AMBER" | "RED",
    };

    if (matrixLog) {
      await prisma.auditLog.update({
        where: { id: matrixLog.id },
        data: { afterJson: JSON.stringify(nextState) },
      });
    } else {
      await AuditService.record({
        saccoId,
        actorId,
        action: "INIT_APPROVAL_MATRIX",
        entity: "LoanApprovalMatrixState",
        entityId: id,
        after: nextState,
      });
    }

    await AuditService.record({
      saccoId,
      actorId,
      action: "APPROVE_MATRIX_STEP",
      entity: "LoanApprovalMatrixStep",
      entityId: `${id}:${actorId}:${Date.now()}`,
      after: {
        loanId: id,
        actorRole: actor.role,
        approvalsCount: nextApprovals.length,
        requiredApproverCount,
        completed,
      },
    });

    if (!completed) {
      DashboardService.invalidateCache(saccoId);
      return {
        ...existing,
        status: "PENDING",
        approvalMatrix: {
          requiredApproverCount,
          approvalsCount: nextApprovals.length,
          requiredRoleGroups,
          completed: false,
          slaDueAtIso: nextState.slaDueAtIso,
          alreadyApproved,
        },
      };
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

    const eligibility = assessment;

    if (eligibility.green) {
      const existingScheduleApproval = await prisma.auditLog.findFirst({
        where: {
          saccoId,
          entity: "LoanScheduleApproval",
          entityId: `${loan.id}:${loan.memberId}`,
        },
      });

      if (!existingScheduleApproval) {
        await AuditService.record({
          saccoId,
          actorId,
          action: "AUTO_APPROVE",
          entity: "LoanScheduleApproval",
          entityId: `${loan.id}:${loan.memberId}`,
          after: {
            loanId: loan.id,
            memberId: loan.memberId,
            approvedAt: new Date().toISOString(),
            approvalMode: "AUTO_GREEN_MEMBER",
            assessment: eligibility,
            schedule: toInstallmentRows(loan),
          },
        });
      }
    }

    DashboardService.invalidateCache(saccoId);

    return loan;
  },

  async disburse(id: string, saccoId: string, actorId?: string) {
    const existing = await prisma.loan.findFirstOrThrow({
      where: { id, saccoId },
    });
    if (existing.status !== "APPROVED") {
      throw new Error("Only approved loans can be disbursed");
    }

    const scheduleApproval = await prisma.auditLog.findFirst({
      where: {
        saccoId,
        entity: "LoanScheduleApproval",
        entityId: `${existing.id}:${existing.memberId}`,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!scheduleApproval) {
      const eligibility = await assessAutoScheduleEligibility({
        saccoId,
        memberId: existing.memberId,
        principalAmount: existing.principalAmount,
      });

      if (eligibility.green) {
        await AuditService.record({
          saccoId,
          actorId,
          action: "AUTO_APPROVE",
          entity: "LoanScheduleApproval",
          entityId: `${existing.id}:${existing.memberId}`,
          after: {
            loanId: existing.id,
            memberId: existing.memberId,
            approvedAt: new Date().toISOString(),
            approvalMode: "AUTO_GREEN_MEMBER_DISBURSE",
            assessment: eligibility,
            schedule: toInstallmentRows(existing),
          },
        });
      } else {
        await AuditService.record({
          saccoId,
          actorId,
          action: "MANUAL_OVERRIDE",
          entity: "LoanScheduleApproval",
          entityId: `${existing.id}:${existing.memberId}`,
          after: {
            loanId: existing.id,
            memberId: existing.memberId,
            approvedAt: new Date().toISOString(),
            approvalMode: "STAFF_OVERRIDE",
            assessment: eligibility,
            reason: "Schedule approval overridden by authorized disbursement role",
            schedule: toInstallmentRows(existing),
          },
        });
      }
    }

    const disbursedAt = new Date();
    const recomputedDueAt = addMonths(disbursedAt, Math.max(1, existing.termMonths));

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        status: "DISBURSED",
        disbursedAt,
        dueAt:
          existing.dueAt && existing.dueAt.getTime() > disbursedAt.getTime()
            ? existing.dueAt
            : recomputedDueAt,
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

    DashboardService.invalidateCache(saccoId);

    return loan;
  },

  async getSchedule(loan: {
    id: string;
    appliedAt: Date;
    termMonths: number;
    principalAmount: Prisma.Decimal;
    interestAmount: Prisma.Decimal;
  }) {
    return toInstallmentRows(loan);
  },

  async approveScheduleByMember(input: {
    loanId: string;
    saccoId: string;
    memberId: string;
    actorId?: string;
  }) {
    const loan = await prisma.loan.findFirstOrThrow({
      where: {
        id: input.loanId,
        saccoId: input.saccoId,
        memberId: input.memberId,
      },
    });

    if (loan.status !== "APPROVED") {
      throw new Error("Only approved loans can have schedule approval");
    }

    const existing = await prisma.auditLog.findFirst({
      where: {
        saccoId: input.saccoId,
        entity: "LoanScheduleApproval",
        entityId: `${loan.id}:${loan.memberId}`,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return {
        loanId: loan.id,
        alreadyApproved: true,
      };
    }

    const schedule = toInstallmentRows(loan);
    await AuditService.record({
      saccoId: input.saccoId,
      actorId: input.actorId,
      action: "APPROVE",
      entity: "LoanScheduleApproval",
      entityId: `${loan.id}:${loan.memberId}`,
      after: {
        loanId: loan.id,
        memberId: loan.memberId,
        approvedAt: new Date().toISOString(),
        schedule,
      },
    });

    return {
      loanId: loan.id,
      alreadyApproved: false,
    };
  },

  async repay(id: string, payload: unknown, actorId?: string) {
    const parsed = loanRepaymentSchema.parse(payload);
    const amount = money(parsed.amount);
    const settings = await SettingsService.get(parsed.saccoId);
    const loan = await prisma.loan.findFirstOrThrow({
      where: { id, saccoId: parsed.saccoId },
    });

    if (!["ACTIVE", "DISBURSED", "DEFAULTED"].includes(loan.status)) {
      throw new Error("Loan must be disbursed, active, or defaulted before repayment");
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

    const penaltyDue = money(decimal(loan.outstandingPenalty).plus(penaltyIncrement));
    const interestDue = money(loan.outstandingInterest);
    const principalDue = money(loan.outstandingPrincipal);
    const totalDue = penaltyDue.plus(interestDue).plus(principalDue);

    if (totalDue.equals(0)) {
      throw new Error("Loan has no outstanding balance");
    }
    if (amount.greaterThan(money(totalDue))) {
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

    if (remaining.greaterThan(new Prisma.Decimal("0.009"))) {
      throw new Error("Repayment exceeds due amount");
    }

    const nextOutstandingPenalty = money(buckets.PENALTY);
    const nextOutstandingInterest = money(buckets.INTEREST);
    const nextOutstandingPrincipal = money(buckets.PRINCIPAL);
    const daysPastDue = Math.max(
      0,
      Math.ceil((now.getTime() - dueAt.getTime()) / DAY_MS),
    );
    const remainingDue = nextOutstandingPrincipal
      .plus(nextOutstandingInterest)
      .plus(nextOutstandingPenalty);
    const fullyCleared = remainingDue.lessThanOrEqualTo(new Prisma.Decimal("0.009"));
    const nextStatus = fullyCleared
      ? "CLEARED"
      : daysPastDue >= settings.delinquency.defaultAfterDaysPastDue
        ? "DEFAULTED"
        : "ACTIVE";

    const repayment = await prisma.$transaction(async (tx) => {
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

    DashboardService.invalidateCache(parsed.saccoId);

    return repayment;
  },
};
