-- CreateTable
CREATE TABLE "SaccoSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIALING',
    "trialStartsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" DATETIME NOT NULL,
    "graceEndsAt" DATETIME,
    "currentPeriodEndsAt" DATETIME,
    "monthlyAmount" DECIMAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "pesapalMerchantRef" TEXT,
    "pesapalTrackingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaccoSubscription_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PESAPAL',
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "reference" TEXT,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingEvent_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SaccoSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SaccoSubscription_saccoId_key" ON "SaccoSubscription"("saccoId");

-- CreateIndex
CREATE INDEX "SaccoSubscription_status_trialEndsAt_idx" ON "SaccoSubscription"("status", "trialEndsAt");

-- CreateIndex
CREATE INDEX "BillingEvent_saccoId_createdAt_idx" ON "BillingEvent"("saccoId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_status_idx" ON "BillingEvent"("subscriptionId", "status");

-- Backfill trial subscriptions for existing SACCOs.
INSERT INTO "SaccoSubscription" (
  "id",
  "saccoId",
  "status",
  "trialStartsAt",
  "trialEndsAt",
  "monthlyAmount",
  "currency",
  "createdAt",
  "updatedAt"
)
SELECT
  lower(hex(randomblob(12))),
  s."id",
  'TRIALING',
  COALESCE(s."createdAt", CURRENT_TIMESTAMP),
  COALESCE(
    datetime(s."createdAt", '+30 day'),
    datetime(substr(s."createdAt", 1, 19), '+30 day'),
    datetime(CURRENT_TIMESTAMP, '+30 day')
  ),
  0,
  'UGX',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Sacco" s
LEFT JOIN "SaccoSubscription" sub ON sub."saccoId" = s."id"
WHERE sub."id" IS NULL;
