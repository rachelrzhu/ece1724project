import nextEnvironment from "@next/env";
import { list } from "@vercel/blob";
import { readBlobEnvironment, readDatabaseEnvironment } from "../lib/config/env";
import { getDatabase } from "../lib/db/client";

async function probe() {
  nextEnvironment.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  let blobToken: string;
  try {
    readDatabaseEnvironment(process.env);
    blobToken = readBlobEnvironment(process.env).BLOB_READ_WRITE_TOKEN;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Check the database and Blob configuration.");
    process.exitCode = 1;
    return;
  }

  const database = getDatabase();
  try {
    const [postgres, blob] = await Promise.allSettled([
      database.$queryRaw`SELECT users.id, files.id AS file_id FROM users LEFT JOIN files ON files.owner_id = users.id LIMIT 0`,
      list({ limit: 1, token: blobToken, abortSignal: AbortSignal.timeout(15_000) }),
    ]);
    console.log(`PostgreSQL users and files tables: ${postgres.status === "fulfilled" ? "accessible" : "failed"}`);
    console.log(`Vercel Blob listing: ${blob.status === "fulfilled" ? "accessible" : "failed"}`);
    if (postgres.status === "rejected" || blob.status === "rejected") process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}

probe().catch(() => {
  console.error("Storage probe failed. Check the credentials, schema, and network connection.");
  process.exitCode = 1;
});
