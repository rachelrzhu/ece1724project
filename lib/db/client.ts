import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readDatabaseEnvironment } from "@/lib/config/env";

const globalDatabase = globalThis as unknown as { database?: PrismaClient };
let database: PrismaClient | undefined;

export function getDatabase(): PrismaClient {
  if (database) return database;
  if (globalDatabase.database) return globalDatabase.database;

  const { DATABASE_URL } = readDatabaseEnvironment(process.env);
  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 20_000,
    statement_timeout: 10_000,
  });
  database = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalDatabase.database = database;
  return database;
}
