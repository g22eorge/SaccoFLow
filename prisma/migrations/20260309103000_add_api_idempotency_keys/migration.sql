CREATE TABLE "ApiIdempotencyKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saccoId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "responseJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ApiIdempotencyKey_saccoId_fkey"
    FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ApiIdempotencyKey_saccoId_scope_key_key" ON "ApiIdempotencyKey"("saccoId", "scope", "key");
CREATE INDEX "ApiIdempotencyKey_saccoId_scope_createdAt_idx" ON "ApiIdempotencyKey"("saccoId", "scope", "createdAt");
