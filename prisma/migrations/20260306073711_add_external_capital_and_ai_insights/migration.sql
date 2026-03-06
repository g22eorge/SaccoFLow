-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPrincipal" DECIMAL NOT NULL,
    "maxPrincipal" DECIMAL NOT NULL,
    "minTermMonths" INTEGER NOT NULL,
    "maxTermMonths" INTEGER NOT NULL,
    "annualRatePercent" DECIMAL,
    "monthlyRatePercent" DECIMAL,
    "repaymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "requireGuarantor" BOOLEAN NOT NULL DEFAULT false,
    "requireCollateral" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoanProduct_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalCapitalTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DONATION',
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "fxRate" DECIMAL NOT NULL DEFAULT 1,
    "baseAmount" DECIMAL NOT NULL,
    "source" TEXT NOT NULL,
    "allocationBucket" TEXT,
    "reference" TEXT,
    "documentUrl" TEXT,
    "note" TEXT,
    "verificationLevel" TEXT NOT NULL DEFAULT 'BASIC',
    "amlFlag" BOOLEAN NOT NULL DEFAULT false,
    "isLargeInflow" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "postedById" TEXT,
    "postedAt" DATETIME,
    "correctionOfId" TEXT,
    "correctionReason" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalCapitalTransaction_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalCapitalTransaction_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExternalCapitalTransaction_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExternalCapitalTransaction_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "ExternalCapitalTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "branch" TEXT,
    "timezone" TEXT,
    "locale" TEXT,
    "avatarUrl" TEXT,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifySms" BOOLEAN NOT NULL DEFAULT false,
    "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notifyRepaymentReminderDays" INTEGER NOT NULL DEFAULT 3,
    "role" TEXT NOT NULL DEFAULT 'SACCO_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppUser_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AppUser" ("authUserId", "createdAt", "email", "fullName", "id", "isActive", "role", "saccoId", "updatedAt") SELECT "authUserId", "createdAt", "email", "fullName", "id", "isActive", "role", "saccoId", "updatedAt" FROM "AppUser";
DROP TABLE "AppUser";
ALTER TABLE "new_AppUser" RENAME TO "AppUser";
CREATE UNIQUE INDEX "AppUser_authUserId_key" ON "AppUser"("authUserId");
CREATE INDEX "AppUser_saccoId_idx" ON "AppUser"("saccoId");
CREATE INDEX "AppUser_email_idx" ON "AppUser"("email");
CREATE TABLE "new_Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "loanProductId" TEXT,
    "termMonths" INTEGER NOT NULL DEFAULT 1,
    "dueAt" DATETIME,
    "principalAmount" DECIMAL NOT NULL,
    "interestAmount" DECIMAL NOT NULL DEFAULT 0,
    "outstandingPrincipal" DECIMAL NOT NULL,
    "outstandingInterest" DECIMAL NOT NULL DEFAULT 0,
    "outstandingPenalty" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "disbursedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Loan_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "LoanProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Loan_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Loan" ("appliedAt", "approvedAt", "createdAt", "disbursedAt", "dueAt", "id", "interestAmount", "memberId", "outstandingInterest", "outstandingPenalty", "outstandingPrincipal", "principalAmount", "saccoId", "status", "termMonths", "updatedAt") SELECT "appliedAt", "approvedAt", "createdAt", "disbursedAt", "dueAt", "id", "interestAmount", "memberId", "outstandingInterest", "outstandingPenalty", "outstandingPrincipal", "principalAmount", "saccoId", "status", "termMonths", "updatedAt" FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
CREATE INDEX "Loan_saccoId_memberId_status_idx" ON "Loan"("saccoId", "memberId", "status");
CREATE INDEX "Loan_loanProductId_idx" ON "Loan"("loanProductId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LoanProduct_saccoId_isActive_idx" ON "LoanProduct"("saccoId", "isActive");

-- CreateIndex
CREATE INDEX "LoanProduct_saccoId_isDefault_idx" ON "LoanProduct"("saccoId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "LoanProduct_saccoId_name_key" ON "LoanProduct"("saccoId", "name");

-- CreateIndex
CREATE INDEX "ExternalCapitalTransaction_saccoId_receivedAt_idx" ON "ExternalCapitalTransaction"("saccoId", "receivedAt");

-- CreateIndex
CREATE INDEX "ExternalCapitalTransaction_saccoId_status_receivedAt_idx" ON "ExternalCapitalTransaction"("saccoId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "ExternalCapitalTransaction_saccoId_type_receivedAt_idx" ON "ExternalCapitalTransaction"("saccoId", "type", "receivedAt");

