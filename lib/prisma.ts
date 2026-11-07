import "server-only";
import { createPrismaClient } from "./db/client";
import { readEnvironment } from "./env";

const globalForPrisma = globalThis as unknown as {
  recipePrisma?: ReturnType<typeof createPrismaClient>;
};

export function getPrisma() {
  if (!globalForPrisma.recipePrisma) {
    const { DATABASE_URL } = readEnvironment();
    if (!DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local before using database features.");
    globalForPrisma.recipePrisma = createPrismaClient(DATABASE_URL);
  }
  return globalForPrisma.recipePrisma;
}
