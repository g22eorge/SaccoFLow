CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSED',
  "payloadHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WebhookEvent_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WebhookEvent_provider_eventKey_key" ON "WebhookEvent"("provider", "eventKey");
CREATE INDEX "WebhookEvent_saccoId_provider_createdAt_idx" ON "WebhookEvent"("saccoId", "provider", "createdAt");
