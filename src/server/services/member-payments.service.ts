import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { SavingsService } from "@/src/server/services/savings.service";
import { SharesService } from "@/src/server/services/shares.service";
import { LoansService } from "@/src/server/services/loans.service";
import { AuditService } from "@/src/server/services/audit.service";
import { SettingsService } from "@/src/server/services/settings.service";

const DEFAULT_CURRENCY = "UGX";

const resolveGatewayForSacco = async (saccoId: string) => {
  const settings = await SettingsService.get(saccoId);
  const configuredSecret = settings.paymentGateway.webhookSecret?.trim();
  return {
    providerEnabled: settings.paymentGateway.providerEnabled,
    checkoutBaseUrl:
      settings.paymentGateway.checkoutBaseUrl ||
      process.env.PESAPAL_CHECKOUT_URL ||
      "https://pay.pesapal.com/iframe/PesapalIframe3/Index",
    memberCallbackUrl:
      settings.paymentGateway.memberCallbackUrl ||
      process.env.PESAPAL_MEMBER_CALLBACK_URL ||
      process.env.PESAPAL_CALLBACK_URL ||
      "https://example.com/api/member/payments/pesapal/webhook",
    merchantAccount: settings.paymentGateway.merchantAccount,
    webhookSecret:
      configuredSecret && configuredSecret !== "change-this-secret"
        ? configuredSecret
        : process.env.PESAPAL_MEMBER_WEBHOOK_SECRET ?? process.env.PESAPAL_WEBHOOK_SECRET ?? null,
  };
};

const buildCheckoutUrl = (reference: string, checkoutBase: string, callbackUrl: string) => {
  return `${checkoutBase}?merchant_reference=${encodeURIComponent(reference)}&callback_url=${encodeURIComponent(callbackUrl)}`;
};

const markerForIntent = (intentId: string) => `payment-intent:${intentId}`;

export const MemberPaymentsService = {
  async createCheckoutIntent(input: {
    saccoId: string;
    memberId: string;
    type: "SAVINGS_DEPOSIT" | "SHARE_PURCHASE" | "LOAN_REPAYMENT";
    amount: number | string;
    loanId?: string;
    note?: string;
    actorId?: string;
  }) {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error("Amount must be greater than zero");
    }

    if (input.type === "LOAN_REPAYMENT") {
      if (!input.loanId) {
        throw new Error("Loan repayment requires a loan selection");
      }
      const loan = await prisma.loan.findFirst({
        where: {
          id: input.loanId,
          saccoId: input.saccoId,
          memberId: input.memberId,
        },
        select: { id: true, status: true },
      });
      if (!loan) {
        throw new Error("Loan not found for member");
      }
      if (
        loan.status !== "ACTIVE" &&
        loan.status !== "DISBURSED" &&
        loan.status !== "DEFAULTED"
      ) {
        throw new Error("Only active, disbursed, or defaulted loans can be repaid");
      }
    }

    const checkoutReference = `MP-${input.saccoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const gateway = await resolveGatewayForSacco(input.saccoId);
    if (!gateway.providerEnabled && process.env.NODE_ENV === "production") {
      throw new Error("Payment gateway is disabled for this organization. Enable it in Settings -> Payment Gateway.");
    }
    const checkoutUrl = buildCheckoutUrl(
      checkoutReference,
      gateway.checkoutBaseUrl,
      gateway.memberCallbackUrl,
    );

    const intent = await prisma.memberPaymentIntent.create({
      data: {
        saccoId: input.saccoId,
        memberId: input.memberId,
        loanId: input.loanId,
        type: input.type,
        amount,
        currency: DEFAULT_CURRENCY,
        checkoutReference,
        checkoutUrl,
        note: input.note,
      },
    });

    await AuditService.record({
      saccoId: input.saccoId,
      actorId: input.actorId,
      action: "CREATE",
      entity: "MemberPaymentIntent",
      entityId: intent.id,
      after: {
        type: intent.type,
        amount: intent.amount.toString(),
        checkoutReference: intent.checkoutReference,
        merchantAccount: gateway.merchantAccount,
      },
    });

    return intent;
  },

  async listMemberIntents(saccoId: string, memberId: string, take = 12) {
    return prisma.memberPaymentIntent.findMany({
      where: { saccoId, memberId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        currency: true,
        checkoutReference: true,
        providerReference: true,
        createdAt: true,
        processedAt: true,
        loanId: true,
      },
    });
  },

  async reconcileWebhook(input: {
    checkoutReference: string;
    paymentStatus: "COMPLETED" | "FAILED" | "PENDING";
    providerReference?: string;
    payload?: unknown;
    providedSecret?: string | null;
  }) {
    const intent = await prisma.memberPaymentIntent.findUnique({
      where: { checkoutReference: input.checkoutReference },
    });

    if (!intent) {
      throw new Error("Payment intent not found");
    }

    const gateway = await resolveGatewayForSacco(intent.saccoId);
    if (gateway.webhookSecret && input.providedSecret !== gateway.webhookSecret) {
      throw new Error("Invalid webhook signature");
    }

    if (input.paymentStatus !== "COMPLETED") {
      if (intent.status === "PENDING") {
        await prisma.memberPaymentIntent.update({
          where: { id: intent.id },
          data: {
            status: input.paymentStatus === "FAILED" ? "FAILED" : "PENDING",
            providerReference: input.providerReference ?? intent.providerReference,
            payloadJson: input.payload ? JSON.stringify(input.payload) : intent.payloadJson,
          },
        });
      }
      return { updated: false, status: input.paymentStatus };
    }

    if (intent.status === "SUCCESS") {
      return { updated: false, status: "SUCCESS" };
    }

    const marker = markerForIntent(intent.id);

    const existingPostedId = await (async () => {
      if (intent.type === "SAVINGS_DEPOSIT") {
        const existing = await prisma.savingsTransaction.findFirst({
          where: {
            saccoId: intent.saccoId,
            memberId: intent.memberId,
            type: "DEPOSIT",
            note: { contains: marker },
          },
          select: { id: true },
        });
        return existing?.id ?? null;
      }

      if (intent.type === "SHARE_PURCHASE") {
        const existing = await prisma.ledgerEntry.findFirst({
          where: {
            saccoId: intent.saccoId,
            memberId: intent.memberId,
            eventType: "SHARE_PURCHASE",
            reference: { contains: marker },
          },
          select: { id: true },
        });
        return existing?.id ?? null;
      }

      const existing = await prisma.loanRepayment.findFirst({
        where: {
          saccoId: intent.saccoId,
          memberId: intent.memberId,
          note: { contains: marker },
        },
        select: { id: true },
      });
      return existing?.id ?? null;
    })();

    let postedTransactionId = existingPostedId;
    if (!postedTransactionId) {
      const note = `${intent.note?.trim() ? `${intent.note.trim()} | ` : ""}${marker}`;
      if (intent.type === "SAVINGS_DEPOSIT") {
        const transaction = await SavingsService.deposit(
          {
            saccoId: intent.saccoId,
            memberId: intent.memberId,
            amount: intent.amount.toString(),
            note,
          },
          undefined,
        );
        postedTransactionId = transaction.id;
      } else if (intent.type === "SHARE_PURCHASE") {
        const transaction = await SharesService.record(
          {
            saccoId: intent.saccoId,
            memberId: intent.memberId,
            type: "PURCHASE",
            amount: intent.amount.toString(),
            note,
          },
          undefined,
        );
        postedTransactionId = transaction.id;
      } else {
        if (!intent.loanId) {
          throw new Error("Loan repayment intent is missing loanId");
        }
        const repayment = await LoansService.repay(
          intent.loanId,
          {
            saccoId: intent.saccoId,
            memberId: intent.memberId,
            amount: intent.amount.toString(),
            note,
          },
          undefined,
        );
        postedTransactionId = repayment.id;
      }
    }

    await prisma.memberPaymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "SUCCESS",
        processedAt: new Date(),
        providerReference: input.providerReference ?? intent.providerReference,
        payloadJson: input.payload ? JSON.stringify(input.payload) : intent.payloadJson,
        postedTransactionId,
      },
    });

    return { updated: true, status: "SUCCESS", postedTransactionId };
  },
};
