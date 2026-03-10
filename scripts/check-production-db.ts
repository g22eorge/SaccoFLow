const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for production DB verification.");
}

if (databaseUrl.startsWith("file:")) {
  throw new Error(
    "Production DB verification failed: DATABASE_URL points to SQLite (file:). Use PostgreSQL for production.",
  );
}

if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
  throw new Error(
    "Production DB verification failed: DATABASE_URL must use postgres:// or postgresql://.",
  );
}

console.log("Production DB verification passed.");
