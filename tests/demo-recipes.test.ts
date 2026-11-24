import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { expect, it } from "vitest";
import { demoAuthors, demoRecipes } from "../scripts/demo-recipes";

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

it("ships a JPEG cover for each demo dish", async () => {
  for (const { photo } of demoRecipes) {
    const file = new URL(`../public/images/${photo}.jpg`, import.meta.url);
    const metadata = await sharp(fileURLToPath(file)).metadata();
    expect(metadata.format, photo).toBe("jpeg");
  }
});
