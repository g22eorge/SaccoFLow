import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "";
const usingSqlite = databaseUrl.startsWith("file:");
const enforceNonSqliteInProduction =
  process.env.ENFORCE_NON_SQLITE_PRODUCTION === "true";

if (process.env.NODE_ENV === "production" && usingSqlite) {
  const message =
    "Production is using SQLite (file:). For scalability and HA, migrate to PostgreSQL.";
  if (enforceNonSqliteInProduction) {
    throw new Error(message);
  }
  console.warn(`[db:warning] ${message}`);
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
