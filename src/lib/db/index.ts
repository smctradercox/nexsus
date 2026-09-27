import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  nexusDb?: Database;
};

export function getDb(): Database {
  if (globalForDb.nexusDb) return globalForDb.nexusDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  globalForDb.nexusDb = drizzle(neon(connectionString), { schema });
  return globalForDb.nexusDb;
}