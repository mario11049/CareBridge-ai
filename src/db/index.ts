import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Lazy, optional database connection.
// CareBridge's demo features do NOT require a database, so this module must
// never throw at import time (that broke builds/deploys when DATABASE_URL was
// unset). The pool is created on first use only.

const globalForDb = globalThis as typeof globalThis & {
  __carebridgePool?: Pool;
  __carebridgeDb?: ReturnType<typeof drizzle>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!globalForDb.__carebridgePool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not configured on this deployment");
    }
    globalForDb.__carebridgePool = new Pool({ connectionString: databaseUrl });
  }
  return globalForDb.__carebridgePool;
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!globalForDb.__carebridgeDb) {
    globalForDb.__carebridgeDb = drizzle(getPool());
  }
  return globalForDb.__carebridgeDb;
}
