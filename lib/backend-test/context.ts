import "server-only";

import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readDatabaseEnvironment } from "@/lib/config/env";
import { createRecipeService } from "@/lib/recipes/service";
import { createImageService } from "@/lib/storage/service";
import { backendTestConfigFile, backendTestConfigSchema } from "./config";
import { BackendTestError } from "./policy";

const globalTestDatabase = globalThis as unknown as { backendTest?: { schema: string; database: PrismaClient } };

export async function getBackendTestContext() {
  if (process.env.NODE_ENV !== "development") throw new BackendTestError(404, "Not found.");
  let config;
  try {
    config = backendTestConfigSchema.parse(JSON.parse(await readFile(backendTestConfigFile, "utf8")));
  } catch {
    throw new BackendTestError(503, "Run npm run backend-test:setup, then refresh.");
  }
  if (globalTestDatabase.backendTest?.schema !== config.schema) {
    await globalTestDatabase.backendTest?.database.$disconnect();
    const { DATABASE_URL } = readDatabaseEnvironment(process.env);
    globalTestDatabase.backendTest = { schema: config.schema, database: new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 15_000, statement_timeout: 10_000 }, { schema: config.schema }),
    }) };
  }
  const database = globalTestDatabase.backendTest.database;
  const readSession = async () => ({ user: { id: config.ownerId } });
  return {
    database, ownerId: config.ownerId,
    recipes: createRecipeService({ database: () => database, readSession }),
    images: createImageService({ database: () => database, readSession }),
  };
}
