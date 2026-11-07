import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Factory is also usable by CLI diagnostics; application code uses the
// server-only singleton in lib/prisma.ts instead of constructing clients.
export function createPrismaClient(connectionString: string) {
  const url = new URL(connectionString);
  // Make node-postgres's existing certificate-verifying behavior explicit.
  // Never opt into weaker libpq compatibility or disable certificate checks.
  if (["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode") ?? "")) {
    url.searchParams.set("sslmode", "verify-full");
  }
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter, log: [] });
}
