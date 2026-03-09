-- Core SACCO operations domain extensions

CREATE TABLE "SavingsProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contributionType" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "minimumAmount" DECIMAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SavingsProduct_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SavingsProduct_saccoId_name_key" ON "SavingsProduct"("saccoId", "name");
CREATE INDEX "SavingsProduct_saccoId_contributionType_isActive_idx" ON "SavingsProduct"("saccoId", "contributionType", "isActive");

CREATE TABLE "MemberKycRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentNumber" TEXT,
  "documentUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MemberKycRecord_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberKycRecord_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberKycRecord_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MemberKycRecord_saccoId_memberId_status_idx" ON "MemberKycRecord"("saccoId", "memberId", "status");
CREATE INDEX "MemberKycRecord_saccoId_createdAt_idx" ON "MemberKycRecord"("saccoId", "createdAt");

CREATE TABLE "MemberBeneficiary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "phone" TEXT,
  "allocationPercent" DECIMAL NOT NULL DEFAULT 100,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MemberBeneficiary_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberBeneficiary_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberBeneficiary_saccoId_memberId_isPrimary_idx" ON "MemberBeneficiary"("saccoId", "memberId", "isPrimary");

CREATE TABLE "LoanGuarantorCommitment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "guarantorMemberId" TEXT NOT NULL,
  "guaranteedAmount" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "releasedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LoanGuarantorCommitment_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LoanGuarantorCommitment_guarantorMemberId_fkey"
    FOREIGN KEY ("guarantorMemberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LoanGuarantorCommitment_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LoanGuarantorCommitment_saccoId_loanId_idx" ON "LoanGuarantorCommitment"("saccoId", "loanId");
CREATE INDEX "LoanGuarantorCommitment_saccoId_guarantorMemberId_status_idx" ON "LoanGuarantorCommitment"("saccoId", "guarantorMemberId", "status");

CREATE TABLE "MemberExitCase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT,
  "notes" TEXT,
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MemberExitCase_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberExitCase_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MemberExitCase_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MemberExitCase_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberExitCase_saccoId_memberId_status_idx" ON "MemberExitCase"("saccoId", "memberId", "status");
CREATE INDEX "MemberExitCase_saccoId_requestedAt_idx" ON "MemberExitCase"("saccoId", "requestedAt");

ALTER TABLE "SavingsTransaction"
  ADD COLUMN "contributionType" TEXT NOT NULL DEFAULT 'VOLUNTARY';

ALTER TABLE "SavingsTransaction"
  ADD COLUMN "savingsProductId" TEXT;
