CREATE TABLE "ReceiptCounter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReceiptCounter_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReceiptCounter_saccoId_scope_key" ON "ReceiptCounter"("saccoId", "scope");

CREATE TABLE "ReceiptVoucher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "serialNumber" INTEGER NOT NULL,
  "receiptCode" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceEntity" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "voidReason" TEXT,
  "voidedAt" DATETIME,
  "reissuedFromId" TEXT,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReceiptVoucher_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReceiptVoucher_saccoId_serialNumber_key" ON "ReceiptVoucher"("saccoId", "serialNumber");
CREATE UNIQUE INDEX "ReceiptVoucher_saccoId_sourceEntity_sourceId_key" ON "ReceiptVoucher"("saccoId", "sourceEntity", "sourceId");
CREATE INDEX "ReceiptVoucher_saccoId_issuedAt_idx" ON "ReceiptVoucher"("saccoId", "issuedAt");
CREATE INDEX "ReceiptVoucher_saccoId_status_issuedAt_idx" ON "ReceiptVoucher"("saccoId", "status", "issuedAt");
