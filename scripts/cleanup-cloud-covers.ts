import nextEnv from "@next/env";
import { parseArgs } from "node:util";
import pg from "pg";
import { BlobNotFoundError, del, head, list } from "@vercel/blob";
import { readBlobEnvironment, readDatabaseEnvironment } from "../lib/config/env";
import { CleanupInputError, checkCleanupTarget, reconcileCovers, type CleanupStorage } from "../lib/storage/cover-cleanup";

const usage = "npm run images:cleanup -- --database HOST/DATABASE --store store_ID [--owner UUID | --path MANAGED_PATH] [--apply]";

async function main() {
  const { values } = parseArgs({ options: {
    database: { type: "string" }, store: { type: "string" }, owner: { type: "string" },
    path: { type: "string" }, apply: { type: "boolean", default: false }, help: { type: "boolean" },
  } });
  if (values.help) { console.log(usage); return; }
  if (!values.database || !values.store || (values.owner !== undefined && values.path !== undefined) ||
      values.owner === "" || values.path === "") throw new CleanupInputError(usage);
  nextEnv.loadEnvConfig(process.cwd());
  if (process.env.POC_LOCAL_ONLY === "1") throw new CleanupInputError("Use poc:cleanup-images for local media.");
  const { DATABASE_URL } = readDatabaseEnvironment(process.env);
  const { BLOB_READ_WRITE_TOKEN: token } = readBlobEnvironment(process.env);
  checkCleanupTarget(DATABASE_URL, token, values.database, values.store);
  const blobOptions = () => ({ token, abortSignal: AbortSignal.timeout(30_000) });
  const storage: CleanupStorage = {
    async inspect(pathname) {
      try { return await head(pathname, blobOptions()); }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
    },
    async remove(pathname, etag) {
      try { await del(pathname, { ...blobOptions(), ifMatch: etag }); }
      catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
    },
    async *listOwner(owner) {
      let cursor: string | undefined;
      for (;;) {
        const page = await list({ ...blobOptions(), prefix: `recipe-images/${owner}/`, cursor, limit: 100 });
        yield* page.blobs;
        if (!page.hasMore) return;
        if (!page.cursor || page.cursor === cursor) throw new Error("Blob pagination stopped advancing.");
        cursor = page.cursor;
      }
    },
  };
  const db = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15_000, statement_timeout: 15_000 });
  console.log(`${values.apply ? "Applying" : "Previewing"} cover cleanup for ${values.database} and ${values.store}.`);
  try {
    await db.connect();
    await reconcileCovers(db, storage, values, console.log);
    console.log(values.apply ? "Cleanup completed." : "Preview complete. Add --apply to reclaim the listed covers.");
  } finally { await db.end(); }
}

main().catch((error: unknown) => {
  // A provider error may contain connection details. Keep operation keys on the
  // individual report lines and avoid dumping connection strings or tokens.
  if (error instanceof CleanupInputError) console.error(error.message);
  else console.error("Cover cleanup stopped. Check the target and provider access, then retry.", error instanceof Error ? error.name : "");
  process.exitCode = 1;
});
