PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AppUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saccoId" TEXT,
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
    CONSTRAINT "AppUser_saccoId_fkey" FOREIGN KEY ("saccoId") REFERENCES "Sacco" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppUser_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_AppUser" (
  "id",
  "saccoId",
  "authUserId",
  "email",
  "fullName",
  "phone",
  "jobTitle",
  "branch",
  "timezone",
  "locale",
  "avatarUrl",
  "notifyEmail",
  "notifySms",
  "notifyWhatsapp",
  "notifyRepaymentReminderDays",
  "role",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  CASE WHEN "role" = 'PLATFORM_SUPER_ADMIN' THEN NULL ELSE "saccoId" END,
  "authUserId",
  "email",
  "fullName",
  "phone",
  "jobTitle",
  "branch",
  "timezone",
  "locale",
  "avatarUrl",
  "notifyEmail",
  "notifySms",
  "notifyWhatsapp",
  "notifyRepaymentReminderDays",
  "role",
  "isActive",
  "createdAt",
  "updatedAt"
FROM "AppUser";

DROP TABLE "AppUser";
ALTER TABLE "new_AppUser" RENAME TO "AppUser";

CREATE UNIQUE INDEX "AppUser_authUserId_key" ON "AppUser"("authUserId");
CREATE INDEX "AppUser_saccoId_idx" ON "AppUser"("saccoId");
CREATE INDEX "AppUser_email_idx" ON "AppUser"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
