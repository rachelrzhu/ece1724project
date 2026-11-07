import nextEnv from "@next/env";
import { list } from "@vercel/blob";
import { createPrismaClient } from "../lib/db/client";
import { readEnvironment } from "../lib/env";

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const env = readEnvironment();
  if (!env.DATABASE_URL || !env.BLOB_READ_WRITE_TOKEN) {
    console.error("Set DATABASE_URL and BLOB_READ_WRITE_TOKEN in .env.local. No cloud data has been changed.");
    process.exitCode = 1;
    return;
  }
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    // Read schema access only; return no personal records or object names.
    const results = await Promise.allSettled([
      prisma.$queryRaw`SELECT users.id, files.id FROM users LEFT JOIN files ON files.owner_id = users.id LIMIT 0`,
      list({ limit: 1, token: env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15_000) }),
    ]);
    for (const [index, result] of results.entries()) {
      console.log(`${index === 0 ? "PostgreSQL via Prisma (starter tables)" : "Vercel Blob"}: ${result.status === "fulfilled" ? "connected" : "failed"}`);
      if (result.status === "rejected") process.exitCode = 1;
    }
    if (process.exitCode) console.error("Check development credentials, network access, and database schema. Provider errors are withheld to protect credentials.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Cloud check failed. Run npm run env:check, then check the configured services. No credentials were printed.");
  process.exitCode = 1;
});
