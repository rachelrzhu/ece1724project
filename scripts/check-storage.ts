import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import nextEnvironment from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { head, list } from "@vercel/blob";
import pg from "pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { readBlobEnvironment, readDatabaseEnvironment } from "../lib/config/env";
import { createRecipeService } from "../lib/recipes/service";
import { privateImageStore, type PrivateImageStore } from "../lib/storage/blob";
import { createImageService, ImageAccessError } from "../lib/storage/service";

if (process.argv.includes("--help")) {
  console.log("Live storage check: creates a disposable PostgreSQL schema and uploads one private sample image. Removes both afterward. Requires DATABASE_URL and BLOB_READ_WRITE_TOKEN. Never applies migrations to public tables. Writes docs/storage-test-results.json.");
  process.exit(0);
}

nextEnvironment.loadEnvConfig(process.cwd());
const runId = randomUUID();
const schemaName = `storage_test_${runId.replaceAll("-", "")}`;
assert.match(schemaName, /^storage_test_[a-f0-9]{32}$/);
const ownerId = randomUUID();
const readerId = randomUUID();
const blobPrefix = `recipe-images/${ownerId}/`;
const ownedPaths = new Set<string>();
const checks: { name: string; status: "passed" | "failed"; detail?: string }[] = [];
let database: PrismaClient | undefined;
let administrator: pg.Client | undefined;
let schemaCreated = false;
let interrupted = false;
let activeCheck = "configuration";
let blobReadCount = 0;
process.once("SIGINT", () => { interrupted = true; });
process.once("SIGTERM", () => { interrupted = true; });

async function check(name: string, operation: () => Promise<void>) {
  activeCheck = name;
  if (interrupted) throw new Error("Storage check interrupted.");
  await operation();
  checks.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
}

const storage: PrivateImageStore = {
  async put(pathname, bytes, contentType) {
    assert.ok(pathname.startsWith(blobPrefix));
    ownedPaths.add(pathname);
    await privateImageStore.put(pathname, bytes, contentType);
  },
  async read(pathname) {
    assert.ok(pathname.startsWith(blobPrefix));
    blobReadCount++;
    return privateImageStore.read(pathname);
  },
  async remove(pathname) {
    assert.ok(pathname.startsWith(blobPrefix));
    await privateImageStore.remove(pathname);
    ownedPaths.delete(pathname);
  },
};

function safeError(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return `${name}${code && /^[A-Z0-9_]+$/.test(code) ? ` (${code})` : ""}`;
}

async function main() {
  try {
    const { DATABASE_URL } = readDatabaseEnvironment(process.env);
    const { BLOB_READ_WRITE_TOKEN } = readBlobEnvironment(process.env);
    administrator = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15_000, statement_timeout: 15_000 });
    await check("database: connect to the configured PostgreSQL server", async () => {
      await administrator!.connect();
    });

    await check("database: apply both migrations in a disposable schema", async () => {
      await administrator!.query(`CREATE SCHEMA "${schemaName}"`);
      schemaCreated = true;
      await administrator!.query("BEGIN");
      try {
        await administrator!.query(`SET LOCAL search_path TO "${schemaName}"`);
        for (const migration of ["0_baseline", "20261108000000_recipe_domain"]) {
          const sql = readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), "utf8")
            .replace('CREATE SCHEMA IF NOT EXISTS "public";', "");
          assert.ok(!sql.includes('"public"'), "Test migrations must not address the public schema.");
          await administrator!.query(sql);
        }
        await administrator!.query("COMMIT");
      } catch (error) {
        await administrator!.query("ROLLBACK");
        throw error;
      }
      database = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: DATABASE_URL,
          max: 2,
          connectionTimeoutMillis: 15_000,
          statement_timeout: 15_000,
        }, { schema: schemaName }),
      });
    });

    const client = database!;
    const ownerSession = async () => ({ user: { id: ownerId } });
    const readerSession = async () => ({ user: { id: readerId } });
    const ownerRecipes = createRecipeService({ database: () => client, readSession: ownerSession });
    const otherRecipes = createRecipeService({ database: () => client, readSession: readerSession });
    const publicRecipes = createRecipeService({ database: () => client, readSession: async () => null });
    let recipeId = "";

    await check("database: add and read users, recipe, ingredients, and steps", async () => {
      await client.user.createMany({ data: [
        { id: ownerId, email: `storage-owner-${runId}@example.test`, name: "Storage test owner" },
        { id: readerId, email: `storage-reader-${runId}@example.test`, name: "Storage test reader" },
      ] });
      const recipe = await ownerRecipes.create({
        title: "Storage test bread", description: "Disposable integration test recipe.",
        baseServings: 4, prepMinutes: 10, cookMinutes: 30, difficulty: "EASY",
        ingredients: [{ name: "Flour", quantity: 400, unit: "g" }],
        steps: [{ instruction: "Mix and bake." }],
      });
      recipeId = recipe.id;
      const stored = await ownerRecipes.getById(recipeId);
      assert.equal(stored?.title, "Storage test bread");
      assert.equal(stored?.baseServings, "4");
      assert.equal(stored?.ingredients[0].quantity, "400");
      assert.equal(stored?.steps.length, 1);
    });

    await check("database: modify and reread recipe, ingredient, and profile", async () => {
      await client.$transaction(async (transaction) => {
        await transaction.recipe.update({ where: { id: recipeId, authorId: ownerId }, data: { title: "Updated storage test bread", baseServings: new Prisma.Decimal("6") } });
        await transaction.recipeIngredient.updateMany({ where: { recipeId }, data: { quantity: new Prisma.Decimal("600.123456") } });
        await transaction.user.update({ where: { id: ownerId }, data: { name: "Updated test owner" } });
      });
      const stored = await ownerRecipes.getById(recipeId);
      assert.equal(stored?.title, "Updated storage test bread");
      assert.equal(stored?.baseServings, "6");
      assert.equal(stored?.ingredients[0].quantity, "600.123456");
      assert.equal((await client.user.findUnique({ where: { id: ownerId }, select: { name: true } }))?.name, "Updated test owner");
    });

    await check("database: enforce private/public reads with two test identities", async () => {
      assert.equal(await otherRecipes.getById(recipeId), null);
      assert.equal(await publicRecipes.getById(recipeId), null);
      await client.recipe.update({ where: { id: recipeId }, data: { visibility: "PUBLIC" } });
      assert.equal((await publicRecipes.getById(recipeId))?.id, recipeId);
      await client.recipe.update({ where: { id: recipeId }, data: { visibility: "PRIVATE" } });
      assert.equal(await otherRecipes.getById(recipeId), null);
    });

    await check("database: prevent duplicate bookmarks", async () => {
      for (let index = 0; index < 2; index++) {
        await client.bookmark.upsert({ where: { userId_recipeId: { userId: readerId, recipeId } }, create: { userId: readerId, recipeId }, update: {} });
      }
      assert.equal(await client.bookmark.count({ where: { userId: readerId, recipeId } }), 1);
    });

    await check("database: roll back a recipe when its child write fails", async () => {
      const failedRecipeId = randomUUID();
      await assert.rejects(client.$transaction(async (transaction) => {
        await transaction.recipe.create({ data: {
          id: failedRecipeId, authorId: ownerId, title: "Rollback test", description: "Must disappear",
          baseServings: new Prisma.Decimal(4), prepMinutes: 0, cookMinutes: 0, difficulty: "EASY",
          ingredients: { create: { position: 0, name: "Flour", canonicalName: "flour", quantity: new Prisma.Decimal(1), unit: "g" } },
        } });
        await transaction.recipeStep.create({ data: { recipeId: failedRecipeId, position: 0, instruction: "" } });
      }), (error: unknown) => error instanceof Error && error.message.includes("recipe_steps_instruction_required"));
      assert.equal(await client.recipe.findUnique({ where: { id: failedRecipeId } }), null);
      assert.equal(await client.recipeIngredient.count({ where: { recipeId: failedRecipeId } }), 0);
    });

    await check("database: delete a recipe and verify cascading child deletion", async () => {
      await client.recipe.delete({ where: { id: recipeId, authorId: ownerId } });
      assert.equal(await client.recipe.findUnique({ where: { id: recipeId } }), null);
      assert.equal(await client.recipeIngredient.count({ where: { recipeId } }), 0);
      assert.equal(await client.recipeStep.count({ where: { recipeId } }), 0);
      assert.equal(await client.bookmark.count({ where: { recipeId } }), 0);
    });

    const ownerImages = createImageService({ database: () => client, readSession: ownerSession, storage });
    const otherImages = createImageService({ database: () => client, readSession: readerSession, storage });
    const anonymousImages = createImageService({ database: () => client, readSession: async () => null, storage });
    const imageBytes = readFileSync(new URL("../tests/fixtures/storage-sample.png", import.meta.url));
    let fileId = "";
    let pathname = "";

    await check("blob: upload a decoded sample PNG and persist its metadata", async () => {
      await assert.rejects(anonymousImages.upload({ name: "sample.png", bytes: imageBytes }), ImageAccessError);
      const file = await ownerImages.upload({ name: "sample.png", bytes: imageBytes });
      fileId = file.id;
      assert.equal(file.size, imageBytes.byteLength);
      assert.equal(file.contentType, "image/png");
      const metadata = await client.storedFile.findUniqueOrThrow({ where: { id: fileId } });
      pathname = metadata.pathname;
      assert.equal(metadata.ownerId, ownerId);
      const remote = await head(pathname, { token: BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15_000) });
      assert.equal(remote.size, imageBytes.byteLength);
      assert.equal(remote.contentType, "image/png");
      assert.ok(new URL(remote.url).hostname.endsWith(".private.blob.vercel-storage.com"));
      const unauthenticated = await fetch(remote.url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      assert.ok([401, 403, 404].includes(unauthenticated.status));
      await unauthenticated.body?.cancel();
    });

    await check("blob: read matching bytes and reject a second user's access", async () => {
      const saved = await ownerImages.readOwn(fileId);
      assert.ok(saved);
      const downloaded = Buffer.from(await new Response(saved.stream).arrayBuffer());
      assert.equal(createHash("sha256").update(downloaded).digest("hex"), createHash("sha256").update(imageBytes).digest("hex"));
      const priorReads = blobReadCount;
      assert.equal(await otherImages.readOwn(fileId), null);
      await assert.rejects(anonymousImages.readOwn(fileId), ImageAccessError);
      assert.equal(blobReadCount, priorReads);
    });

    await check("database: modify uploaded image metadata", async () => {
      await client.storedFile.update({ where: { id: fileId, ownerId }, data: { name: "updated-sample.png" } });
      const updated = await client.storedFile.findUniqueOrThrow({ where: { id: fileId } });
      assert.equal(updated.name, "updated-sample.png");
      assert.equal(updated.pathname, pathname);
    });

    await check("blob: delete the sample object and its metadata", async () => {
      await storage.remove(pathname);
      await client.storedFile.delete({ where: { id: fileId, ownerId } });
      assert.equal(await privateImageStore.read(pathname), null);
      assert.equal(await client.storedFile.findUnique({ where: { id: fileId } }), null);
    });

    await check("database: remove the disposable test users", async () => {
      const result = await client.user.deleteMany({ where: { id: { in: [ownerId, readerId] } } });
      assert.equal(result.count, 2);
      assert.equal(await client.user.count(), 0);
    });
  } catch (error) {
    checks.push({ name: activeCheck, status: "failed", detail: safeError(error) });
    console.error(`FAIL ${activeCheck}: ${safeError(error)}`);
    process.exitCode = 1;
  } finally {
    for (const pathname of ownedPaths) {
      try { await storage.remove(pathname); }
      catch (error) {
        checks.push({ name: "cleanup: sample Blob object", status: "failed", detail: `${pathname}: ${safeError(error)}` });
        process.exitCode = 1;
      }
    }
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const remaining = await list({ prefix: blobPrefix, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15_000) });
        assert.equal(remaining.blobs.length, 0);
        checks.push({ name: "cleanup: no sample Blob objects remain", status: "passed" });
      } catch (error) {
        checks.push({ name: "cleanup: verify sample Blob removal", status: "failed", detail: safeError(error) });
        process.exitCode = 1;
      }
    }
    try { await database?.$disconnect(); }
    catch (error) {
      checks.push({ name: "cleanup: disconnect Prisma", status: "failed", detail: safeError(error) });
      process.exitCode = 1;
    }
    if (schemaCreated && administrator) {
      try {
        await administrator.query(`DROP SCHEMA "${schemaName}" CASCADE`);
        const result = await administrator.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname = $1", [schemaName]);
        assert.equal(result.rows[0].count, 0);
        checks.push({ name: "cleanup: disposable PostgreSQL schema removed", status: "passed" });
      } catch (error) {
        checks.push({ name: "cleanup: disposable PostgreSQL schema", status: "failed", detail: `${schemaName}: ${safeError(error)}` });
        process.exitCode = 1;
      }
    }
    try { await administrator?.end(); }
    catch (error) {
      checks.push({ name: "cleanup: close PostgreSQL connection", status: "failed", detail: safeError(error) });
      process.exitCode = 1;
    }
    const report = {
      checkedAt: new Date().toISOString(),
      runId,
      status: checks.some((entry) => entry.status === "failed") ? "failed" : "passed",
      scope: "Live PostgreSQL through Prisma in a disposable schema; private Blob sample upload/read/delete. Public database tables and migration history are not modified. Test identities are injected, not authenticated browser sessions.",
      sample: "tests/fixtures/storage-sample.png",
      checks,
    };
    writeFileSync(new URL("../docs/storage-test-results.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}

await main();
