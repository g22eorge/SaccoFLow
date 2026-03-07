-- CreateTable
CREATE TABLE "AppUserTenantAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authUserId" TEXT NOT NULL,
    "saccoId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppUserTenantAccess_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AppUser" ("authUserId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppUserTenantAccess_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUserTenantAccess_authUserId_saccoId_key" ON "AppUserTenantAccess"("authUserId", "saccoId");

-- CreateIndex
CREATE INDEX "AppUserTenantAccess_authUserId_isActive_idx" ON "AppUserTenantAccess"("authUserId", "isActive");

-- CreateIndex
CREATE INDEX "AppUserTenantAccess_saccoId_isActive_idx" ON "AppUserTenantAccess"("saccoId", "isActive");

-- Backfill existing active app users with baseline tenant access.
INSERT INTO "AppUserTenantAccess" ("id", "authUserId", "saccoId", "role", "isActive", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(12))),
  "authUserId",
  "saccoId",
  "role",
  "isActive",
  "createdAt",
  "updatedAt"
FROM "AppUser"
WHERE "isActive" = true;
