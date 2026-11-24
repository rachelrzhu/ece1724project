import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { checkCleanupTarget, reconcileCovers, type CleanupStorage } from "@/lib/storage/cover-cleanup";
import { ownerId, otherUserId, coverId, recipeId } from "./fixtures";

const db = new PGlite();
const now = new Date("2026-11-23T00:00:00Z");
const old = new Date("2026-11-20T00:00:00Z");
const pathname = `recipe-images/${ownerId}/${coverId}.png`;
const blob = { pathname, uploadedAt: old, etag: "version1" };
const unknown = `recipe-images/${otherUserId}/${coverId}.png`;

beforeAll(async () => {
  for (const migration of ["0_baseline", "20261108000000_recipe_domain"]) {
    await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
  await db.query("INSERT INTO users (id, email) VALUES ($1, 'cook@example.test')", [ownerId]);
});
afterAll(() => db.close());
beforeEach(async () => { await db.exec("TRUNCATE files, recipes CASCADE"); });

async function createFile(createdAt = old, path = pathname) {
  await db.query(`INSERT INTO files (id, owner_id, name, pathname, size, content_type, created_at)
    VALUES ($1,$2,'cover',$3,100,'image/png',$4)`, [coverId, ownerId, path, createdAt]);
}
async function attachedRecipe() {
  await db.query(`INSERT INTO recipes (id, author_id, title, description, base_servings, prep_minutes, cook_minutes, difficulty, cover_file_id)
    VALUES ($1,$2,'Bread','Bread',4,0,10,'EASY',$3)`, [recipeId, ownerId, coverId]);
}
const remaining = async () => (await db.query("SELECT id FROM files")).rows.length;
function storage() {
  return {
    inspect: vi.fn<CleanupStorage["inspect"]>().mockResolvedValue(blob),
    remove: vi.fn<CleanupStorage["remove"]>().mockResolvedValue(undefined),
    listOwner: vi.fn(async function* () { yield blob; yield { ...blob, pathname: unknown }; }),
  };
}

it("rejects a mismatched target even if only one credential points elsewhere", () => {
  const args = ["postgresql://u:secret@dev.test:5433/savor", "vercel_blob_rw_DevStore_secret"] as const;
  expect(() => checkCleanupTarget(...args, "dev.test:5433/savor", "store_DevStore")).not.toThrow();
  expect(() => checkCleanupTarget(...args, "dev.test:5433/other", "store_DevStore")).toThrow();
  expect(() => checkCleanupTarget(...args, "dev.test:5433/savor", "store_ProdStore")).toThrow();
});

it("previews old unattached metadata and removes the matching version only on apply", async () => {
  await createFile();
  const store = storage();
  const report = vi.fn();
  await reconcileCovers(db, store, { apply: false }, report, now);
  expect(await remaining()).toBe(1);
  expect(store.remove).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(expect.stringContaining(pathname));
  await reconcileCovers(db, store, { apply: true }, report, now);
  expect(await remaining()).toBe(0);
  expect(store.remove).toHaveBeenCalledWith(pathname, "version1");
});

it("rechecks an attachment committed between the candidate scan and deletion", async () => {
  await createFile();
  const store = storage();
  store.inspect.mockImplementationOnce(async () => { await attachedRecipe(); return blob; });
  await reconcileCovers(db, store, { apply: true }, vi.fn(), now);
  expect(await remaining()).toBe(1);
  expect(store.remove).not.toHaveBeenCalled();
});

it("preserves fresh objects and metadata, and skips pre-existing non-upload paths", async () => {
  const store = storage();
  await createFile(now);
  await reconcileCovers(db, store, { apply: true, path: pathname }, vi.fn(), now);
  await db.query("UPDATE files SET created_at = $1", [old]);
  store.inspect.mockResolvedValue({ ...blob, uploadedAt: now });
  await reconcileCovers(db, store, { apply: true }, vi.fn(), now);
  await db.query("UPDATE files SET pathname = 'seed/demo.jpg'");
  await reconcileCovers(db, store, { apply: true }, vi.fn(), now);
  expect(await remaining()).toBe(1);
  expect(store.remove).not.toHaveBeenCalled();
});

it("can retry an exact unrecorded path after a post-commit Blob failure", async () => {
  await createFile();
  const store = storage();
  store.remove.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(reconcileCovers(db, store, { apply: true }, vi.fn(), now)).rejects.toThrow();
  expect(await remaining()).toBe(0);
  await reconcileCovers(db, store, { apply: true, path: pathname }, vi.fn(), now);
  expect(store.remove).toHaveBeenCalledTimes(2);
  store.inspect.mockResolvedValue(null);
  await reconcileCovers(db, store, { apply: true, path: pathname }, vi.fn(), now);
  expect(store.remove).toHaveBeenCalledTimes(2);
});

it("discovers only managed old objects for a verified product owner", async () => {
  const store = storage();
  await expect(reconcileCovers(db, store, { apply: true, owner: otherUserId }, vi.fn(), now)).rejects.toThrow();
  expect(store.listOwner).not.toHaveBeenCalled();
  await reconcileCovers(db, store, { apply: true, owner: ownerId }, vi.fn(), now);
  expect(store.remove.mock.calls).toEqual([[pathname, "version1"]]);
  await expect(reconcileCovers(db, store, { apply: true, path: "../foreign" }, vi.fn(), now)).rejects.toThrow();
});
