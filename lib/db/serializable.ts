import "server-only";
import { randomInt } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

function serializationConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034";
  // The PostgreSQL adapter can expose a commit-time serialization abort directly.
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") return false;
  const cause = error.cause;
  return typeof cause === "object" && cause !== null && "originalCode" in cause && cause.originalCode === "40001";
}

// A serialization conflict definitively rolled back the transaction. Keep
// external effects outside the callback so a retry only repeats database work.
export async function serializableTransaction<T>(
  db: PrismaClient,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= 4 || !serializationConflict(error)) throw error;
      await delay(20 * 2 ** (attempt - 1) + randomInt(30));
    }
  }
}
