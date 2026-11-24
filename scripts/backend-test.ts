import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import nextEnvironment from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { list } from "@vercel/blob";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { backendTestConfigFile, backendTestConfigSchema } from "../lib/backend-test/config";
import { readBlobEnvironment, readDatabaseEnvironment } from "../lib/config/env";
import { privateImageStore } from "../lib/storage/blob";

nextEnvironment.loadEnvConfig(process.cwd());
const command = process.argv[2];
if (!["setup", "cleanup"].includes(command)) throw new Error("Use backend-test:setup or backend-test:cleanup.");
const { DATABASE_URL } = readDatabaseEnvironment(process.env);
let config;
try { config = backendTestConfigSchema.parse(JSON.parse(await readFile(backendTestConfigFile, "utf8"))); }
catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw new Error("Invalid local backend-test configuration. Restore it before continuing.");
}

const administrator = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15_000, statement_timeout: 15_000 });
let database: PrismaClient | undefined;
let createdSchema: string | undefined;
let saved = false;

try {
  await administrator.connect();
  if (command === "setup") {
    if (config) {
      const exists = await administrator.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [config.schema]);
      if (!exists.rowCount) throw new Error("The test schema is missing. Run backend-test:cleanup, then backend-test:setup.");
      console.log("Backend test database is already prepared. Open /backend-test with npm run dev.");
    } else {
      config = { schema: `backend_test_${randomUUID().replaceAll("-", "")}`, ownerId: randomUUID() };
      backendTestConfigSchema.parse(config);
      await administrator.query(`CREATE SCHEMA "${config.schema}"`);
      createdSchema = config.schema;
      await administrator.query("BEGIN");
      try {
        await administrator.query(`SET LOCAL search_path TO "${config.schema}"`);
        for (const migration of ["0_baseline", "20261108000000_recipe_domain", "20261108120000_authentication", "20261123000000_recipe_copy_source", "20261123010000_dietary_preferences", "20261123020000_usernames"]) {
          const sql = (await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), "utf8")).replace('CREATE SCHEMA IF NOT EXISTS "public";', "");
          if (sql.includes('"public"')) throw new Error("Test migrations must not address public tables.");
          await administrator.query(sql);
        }
        await administrator.query("COMMIT");
      } catch (error) { await administrator.query("ROLLBACK"); throw error; }
      database = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 15_000, statement_timeout: 10_000 }, { schema: config.schema }) });
      await database.user.create({ data: { id: config.ownerId, email: `${config.ownerId}@backend-test.example`, name: "Local backend tester" } });
      await writeFile(backendTestConfigFile, JSON.stringify(config, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      saved = true;
      console.log("Backend test database prepared. Run npm run dev and open /backend-test.");
    }
  } else if (config) {
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      const { BLOB_READ_WRITE_TOKEN } = readBlobEnvironment(process.env);
      let cursor: string | undefined;
      do {
        const result = await list({ prefix: `recipe-images/${config.ownerId}/`, token: BLOB_READ_WRITE_TOKEN, cursor, limit: 100, abortSignal: AbortSignal.timeout(30_000) });
        for (const blob of result.blobs) await privateImageStore.remove(blob.pathname);
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
    } else {
      // Keep the owner/prefix recoverable if image cleanup still needs credentials.
      const exists = await administrator.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [config.schema]);
      if (exists.rowCount) {
        const files = await administrator.query(`SELECT 1 FROM "${config.schema}".files LIMIT 1`);
        if (files.rowCount) throw new Error("Set BLOB_READ_WRITE_TOKEN before cleaning up uploaded test images.");
      }
    }
    await administrator.query(`DROP SCHEMA IF EXISTS "${config.schema}" CASCADE`);
    await unlink(backendTestConfigFile);
    console.log("Backend test cleanup completed: schema/configuration removed and configured image storage cleaned.");
  } else console.log("No backend test setup to clean up.");
} catch (error) {
  // Keep provider error details and connection information out of command output.
  console.error(error instanceof Error && !error.message.includes("\n") && !/postgres(?:ql)?:\/\/|vercel_blob_/i.test(error.message) ? error.message : "Backend test setup failed. Check your database and Blob configuration.");
  process.exitCode = 1;
} finally {
  await database?.$disconnect();
  if (createdSchema && !saved) await administrator.query(`DROP SCHEMA IF EXISTS "${createdSchema}" CASCADE`);
  await administrator.end();
}
