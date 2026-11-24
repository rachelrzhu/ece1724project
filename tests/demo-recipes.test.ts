import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { expect, it } from "vitest";
import { getPublishedSource } from "../lib/recipes/published-sources";
import { demoAuthors, demoId, demoRecipes } from "../scripts/demo-recipes";
import { publishedChineseRecipes } from "../scripts/published-chinese-recipes";

it("gives every demo recipe a unique slot and a known author", () => {
  const authorSlots = new Set(demoAuthors.map((author) => author.slot));
  expect(authorSlots.size).toBe(demoAuthors.length);
  expect(new Set(demoRecipes.map((recipe) => recipe.slot)).size).toBe(demoRecipes.length);
  for (const recipe of demoRecipes) {
    expect(authorSlots.has(recipe.authorSlot), recipe.title).toBe(true);
  }
});

it("keeps the original private fixture out of the public catalog", () => {
  expect(demoRecipes.find((recipe) => recipe.slot === 8)?.isPrivate).toBe(true);
});

it("credits each translated recipe to its contributor and pinned Chinese edition", () => {
  for (const recipe of publishedChineseRecipes) {
    const source = getPublishedSource(demoId("recipe", recipe.slot));
    expect(source, recipe.title).toBeDefined();
    expect(recipe.description).toContain(source!.contributor);
    const url = new URL(source!.url);
    expect(url.origin).toBe("https://github.com");
    expect(decodeURI(url.pathname)).toMatch(/^\/Anduin2017\/HowToCook\/blob\/[a-f0-9]{40}\/dishes\/.+\.md$/);
  }
});

it("ships a JPEG cover for each demo dish", async () => {
  for (const { photo } of demoRecipes) {
    const file = new URL(`../public/images/${photo}.jpg`, import.meta.url);
    const metadata = await sharp(fileURLToPath(file)).metadata();
    expect(metadata.format, photo).toBe("jpeg");
  }
});
