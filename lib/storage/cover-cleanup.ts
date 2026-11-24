import { z } from "zod";

export class CleanupInputError extends Error {}

interface Database {
  query<Row extends Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: Row[] }>;
}

interface BlobVersion {
  pathname: string;
  etag: string;
  uploadedAt: Date;
}

export interface CleanupStorage {
  inspect(pathname: string): Promise<BlobVersion | null>;
  remove(pathname: string, etag: string): Promise<void>;
  listOwner(ownerId: string): AsyncIterable<BlobVersion>;
}

interface CleanupOptions {
  apply: boolean;
  owner?: string;
  path?: string;
}

const uuid = z.uuid();

function imageKey(pathname: string) {
  const match = /^recipe-images\/([^/]+)\/([^/]+)\.(jpg|png|webp)$/.exec(pathname);
  if (!match || !uuid.safeParse(match[1]).success || !uuid.safeParse(match[2]).success) return null;
  return { owner: match[1], id: match[2] };
}

export function checkCleanupTarget(databaseUrl: string, token: string, database: string, store: string) {
  const url = new URL(databaseUrl);
  // Both the host and database name distinguish targets. Never return the credential-bearing URL.
  const expectedDatabase = url.host + url.pathname;
  const tokenStore = /^vercel_blob_rw_([a-zA-Z0-9]+)_.+$/.exec(token)?.[1];
  if (database !== expectedDatabase || !tokenStore || store !== `store_${tokenStore}`) {
    throw new CleanupInputError("The supplied database and store IDs must match the intended target credentials.");
  }
}

export async function reconcileCovers(
  db: Database, storage: CleanupStorage, options: CleanupOptions, report: (message: string) => void,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  async function knownOwner(id: string) {
    return (await db.query("SELECT id FROM public.users WHERE id = $1::uuid", [id])).rows.length === 1;
  }

  async function reconcile(pathname: string, listed?: BlobVersion) {
    const key = imageKey(pathname);
    if (!key) {
      report("Skipped a file outside the managed recipe upload namespace.");
      return;
    }
    const blob = listed ?? await storage.inspect(pathname);
    if (blob && (blob.pathname !== pathname || !blob.etag || !(blob.uploadedAt < cutoff))) return;
    if (options.apply) await db.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    try {
      // An attachment takes a foreign-key lock. After acquiring our conflicting row lock,
      // a fresh statement sees an attachment that committed while cleanup waited.
      const { rows: files } = await db.query<{
        id: string; owner_id: string; pathname: string; created_at: Date;
      }>(`SELECT id, owner_id, pathname, created_at FROM public.files
          WHERE id = $1::uuid OR pathname = $2 ${options.apply ? "FOR UPDATE" : ""}`, [key.id, pathname]);
      const file = files[0];
      const eligible = file
        ? files.length === 1 && file.id === key.id && file.owner_id === key.owner &&
          file.pathname === pathname && file.created_at < cutoff &&
          !(await db.query("SELECT id FROM public.recipes WHERE cover_file_id = $1::uuid", [file.id])).rows.length
        : blob && await knownOwner(key.owner);
      if (!eligible) {
        if (options.apply) await db.query("COMMIT");
        return;
      }
      // Record the exact immutable key before committing. A failed/ambiguous delete
      // can be recovered by --path or by a subsequent scan of this owner's prefix.
      report(`${options.apply ? "Reclaim" : "Would reclaim"} ${file ? "unattached cover" : "unrecorded upload"} ${pathname}`);
      if (!options.apply) return;
      if (file) await db.query("DELETE FROM public.files WHERE id = $1::uuid", [file.id]);
      await db.query("COMMIT");
    } catch (error) {
      if (options.apply) await db.query("ROLLBACK");
      throw error;
    }
    if (blob) await storage.remove(pathname, blob.etag);
  }

  if (options.path) {
    const key = imageKey(options.path);
    if (!key || !(await knownOwner(key.owner))) throw new CleanupInputError("Select a managed upload path for an existing product user.");
    await reconcile(options.path);
    return;
  }
  if (options.owner && (!uuid.safeParse(options.owner).success || !(await knownOwner(options.owner)))) {
    throw new CleanupInputError("Select an existing product user's UUID.");
  }

  // The database pass also reclaims eligible metadata for storage objects already gone.
  let lastId: string | null = null;
  for (;;) {
    const rows: { id: string; pathname: string }[] = (await db.query<{ id: string; pathname: string }>(
      `SELECT f.id, f.pathname FROM public.files AS f
       WHERE f.created_at < $1 AND ($2::uuid IS NULL OR f.id > $2)
       AND ($3::uuid IS NULL OR f.owner_id = $3)
       AND NOT EXISTS (SELECT 1 FROM public.recipes AS r WHERE r.cover_file_id = f.id)
       ORDER BY f.id LIMIT 100`, [cutoff, lastId, options.owner ?? null])).rows;
    for (const row of rows) await reconcile(row.pathname);
    if (rows.length < 100) break;
    lastId = rows[rows.length - 1].id;
  }

  if (options.owner) {
    // Sandbox schemas share this store. Scan only a verified product owner's prefix.
    for await (const blob of storage.listOwner(options.owner)) {
      const key = imageKey(blob.pathname);
      if (key?.owner !== options.owner || !(blob.uploadedAt < cutoff)) continue;
      const file = await db.query("SELECT id FROM public.files WHERE pathname = $1", [blob.pathname]);
      if (!file.rows.length) await reconcile(blob.pathname, blob);
    }
  }
}
