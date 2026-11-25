import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { provisionCatalogCovers } from "../scripts/catalog-covers";
import { demoId, demoRecipes } from "../scripts/demo-recipes";

const sdk = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@vercel/blob", () => ({ ...sdk, BlobNotFoundError: class extends Error {} }));
const store = new Map<string, Buffer>();
const token = "test-store-token";
const publicRecipes = demoRecipes.filter(recipe => !recipe.isPrivate);

beforeEach(() => {
  store.clear();
  vi.resetAllMocks();
  sdk.get.mockImplementation(async (pathname: string) => {
    const bytes = store.get(pathname);
    return bytes ? { statusCode: 200, stream: new Blob([Uint8Array.from(bytes)]).stream() } : null;
  });
  sdk.put.mockImplementation(async (pathname: string, bytes: Buffer) => {
    if (store.has(pathname)) throw new Error("Already exists");
    store.set(pathname, bytes);
  });
});

it("provisions each public image once and reads it back from the private store", async () => {
  expect(await provisionCatalogCovers(token)).toEqual({ verified: publicRecipes.length, uploaded: publicRecipes.length });
  for (const { slot, photo } of publicRecipes) {
    const pathname = `seed/${demoId("cover", slot)}.jpg`;
    const bytes = readFileSync(`public/images/${photo}.jpg`);
    expect(store.get(pathname)).toEqual(bytes);
    expect(sdk.put).toHaveBeenCalledWith(pathname, bytes, expect.objectContaining({
      access: "private", token, contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: false,
    }));
    expect(sdk.get).toHaveBeenCalledWith(pathname, expect.objectContaining({ access: "private", token, useCache: false }));
  }
  expect(store.has(`seed/${demoId("cover", 8)}.jpg`)).toBe(false);
  sdk.put.mockClear();
  expect(await provisionCatalogCovers(token)).toEqual({ verified: publicRecipes.length, uploaded: 0 });
  expect(sdk.put).not.toHaveBeenCalled();
});

it("stops before writing anything when a later public cover has different bytes", async () => {
  const pathname = `seed/${demoId("cover", 17)}.jpg`;
  const occupied = Buffer.from("existing unrelated photo");
  store.set(pathname, occupied);
  await expect(provisionCatalogCovers(token)).rejects.toThrow(pathname);
  expect(sdk.put).not.toHaveBeenCalled();
  expect(store.get(pathname)).toBe(occupied);
});

it("accepts a concurrent create only after verifying its contents", async () => {
  sdk.put.mockImplementationOnce(async (pathname: string, bytes: Buffer) => {
    store.set(pathname, bytes);
    throw new Error("Already exists");
  });
  expect(await provisionCatalogCovers(token)).toEqual({ verified: publicRecipes.length, uploaded: publicRecipes.length - 1 });
  store.clear();
  sdk.put.mockImplementationOnce(async (pathname: string) => {
    store.set(pathname, Buffer.from("different"));
    throw new Error("Already exists");
  });
  await expect(provisionCatalogCovers(token)).rejects.toThrow("differs");
});
