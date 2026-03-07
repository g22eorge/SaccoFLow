-- CreateTable
CREATE TABLE "MemberPaymentIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "loanId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "provider" TEXT NOT NULL DEFAULT 'PESAPAL',
    "checkoutReference" TEXT NOT NULL,
    "providerReference" TEXT,
    "checkoutUrl" TEXT,
    "note" TEXT,
    "payloadJson" TEXT,
    "postedTransactionId" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberPaymentIntent_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberPaymentIntent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberPaymentIntent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberPaymentIntent_checkoutReference_key" ON "MemberPaymentIntent"("checkoutReference");

-- CreateIndex
CREATE INDEX "MemberPaymentIntent_saccoId_memberId_createdAt_idx" ON "MemberPaymentIntent"("saccoId", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberPaymentIntent_status_createdAt_idx" ON "MemberPaymentIntent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MemberPaymentIntent_loanId_idx" ON "MemberPaymentIntent"("loanId");
