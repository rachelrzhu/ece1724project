import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { demoId, demoRecipes } from "./demo-recipes";

type Cover = { pathname: string; bytes: Buffer };

async function verifyIfPresent({ pathname, bytes }: Cover, token: string) {
  const result = await get(pathname, {
    access: "private", token, useCache: false, abortSignal: AbortSignal.timeout(30_000),
  }).catch((error: unknown) => {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  });
  if (!result) return false;
  if (result.statusCode !== 200) throw new Error(`Could not read ${pathname} for verification.`);

  const reader = result.stream.getReader();
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!bytes.subarray(offset, offset + value.length).equals(value)) {
      await reader.cancel();
      throw new Error(`The stored photo at ${pathname} differs from the catalog JPEG.`);
    }
    offset += value.length;
  }
  if (offset !== bytes.length) throw new Error(`The stored photo at ${pathname} is incomplete.`);
  return true;
}

export async function provisionCatalogCovers(token: string) {
  if (!token.trim()) throw new Error("Set BLOB_READ_WRITE_TOKEN for the target private store.");
  const catalog = demoRecipes.filter(recipe => !recipe.isPrivate);
  const missing: Cover[] = [];
  for (const recipe of catalog) {
    const pathname = `seed/${demoId("cover", recipe.slot)}.jpg`;
    const bytes = await readFile(new URL(`../public/images/${recipe.photo}.jpg`, import.meta.url));
    const cover = { pathname, bytes };
    if (!await verifyIfPresent(cover, token)) missing.push(cover);
  }

  let uploaded = 0;
  for (const cover of missing) {
    try {
      await put(cover.pathname, cover.bytes, {
        access: "private", token, contentType: "image/jpeg", addRandomSuffix: false,
        allowOverwrite: false, abortSignal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      // A simultaneous import or an interrupted response may already have stored the same JPEG.
      if (await verifyIfPresent(cover, token)) continue;
      throw error;
    }
    if (!await verifyIfPresent(cover, token)) throw new Error(`Could not verify the uploaded photo at ${cover.pathname}.`);
    uploaded++;
  }
  return { verified: catalog.length, uploaded };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  try {
    const { verified, uploaded } = await provisionCatalogCovers(token);
    console.log(`Verified ${verified} catalog covers. Uploaded ${uploaded}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog cover provisioning failed.";
    console.error(token ? message.replaceAll(token, "[redacted]") : message);
    process.exitCode = 1;
  }
}
