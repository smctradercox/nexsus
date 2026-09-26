import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  nexusPool?: Pool;
  nexusDb?: Database;
};

export function getDb(): Database {
  if (globalForDb.nexusDb) return globalForDb.nexusDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
  });

  globalForDb.nexusPool = pool;
  globalForDb.nexusDb = drizzle(pool, { schema });
  return globalForDb.nexusDb;
}