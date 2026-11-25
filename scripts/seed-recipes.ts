import nextEnv from "@next/env";
import { constants } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { demoAuthors, demoId, demoRecipes } from "./demo-recipes";

nextEnv.loadEnvConfig(process.cwd());
const { getDatabase } = await import("../lib/db/client");
const { isLocalPoc } = await import("../lib/product/local");
if (!isLocalPoc())
  throw new Error("Run the recipe seed script against the local test database.");
const db = getDatabase();
for (const { slot, localEmail: email, publicEmail, name } of demoAuthors) {
  const id = demoId("author", slot);
  const user = await db.user.upsert({
    where: { id, OR: [{ email }, { email: publicEmail }] },
    create: { id, email, name },
    update: {},
    select: { email: true },
  });
  // Only the two local test logins need credentials.
  if (slot > 2) continue;
  if (user.email === publicEmail)
    await db.user.update({ where: { id, email: publicEmail }, data: { email } });
  if (!(await db.account.findFirst({ where: { userId: id, providerId: "credential" } }))) {
    await db.account.create({
      data: {
        userId: id,
        providerId: "credential",
        accountId: id,
        password: await hashPassword("SavorKitchen2026!"),
      },
    });
  }
}

await mkdir(".local-poc/media/seed", { recursive: true });
for (const recipe of demoRecipes) {
  const id = demoId("recipe", recipe.slot);
  const authorId = demoId("author", recipe.authorSlot);
  const coverId = demoId("cover", recipe.slot);
  const pathname = `seed/${coverId}.jpg`;
  const name = `${recipe.photo}.jpg`;
  const source = new URL(`../public/images/${name}`, import.meta.url);
  const { size } = await stat(source);
  const existing = await db.recipe.findUnique({
    where: { id },
    select: { authorId: true, cover: { select: { id: true, ownerId: true, pathname: true, name: true, contentType: true, size: true } } },
  });
  if (existing) {
    const cover = existing.cover;
    if (existing.authorId !== authorId || cover?.id !== coverId || cover.ownerId !== authorId ||
        cover.pathname !== pathname || cover.name !== name || cover.contentType !== "image/jpeg" || cover.size !== size) continue;
    // Upgrade the original private fixture while preserving titles edited locally.
    if (recipe.slot === 8) {
      await db.recipe.updateMany({
        where: {
          id,
          authorId,
          coverFileId: coverId,
          visibility: "PRIVATE",
          title: "Rachel’s kitchen notes",
        },
        data: { title: recipe.title },
      });
    }
  } else {
    await db.$transaction(async (tx) => {
      await tx.storedFile.create({
        data: {
          id: coverId,
          ownerId: authorId,
          pathname,
          name,
          contentType: "image/jpeg",
          size,
        },
      });
      await tx.recipe.create({
        data: {
          id,
          authorId,
          title: recipe.title,
          description: recipe.description,
          baseServings: recipe.servings,
          prepMinutes: recipe.prep,
          cookMinutes: recipe.cook,
          difficulty: "EASY",
          visibility: recipe.isPrivate ? "PRIVATE" : "PUBLIC",
          coverFileId: coverId,
          createdAt: new Date(Date.UTC(2026, 10, 8, 12, 0, 0) - (recipe.slot - 1) * 60000),
          ingredients: {
            create: recipe.ingredients.map(
              ([name, quantity, unit, note], position) => ({
                name,
                canonicalName: name.toLowerCase(),
                quantity,
                unit,
                note,
                position,
              }),
            ),
          },
          steps: {
            create: recipe.steps.map((instruction, position) => ({
              instruction,
              position,
            })),
          },
        },
      });
    });
  }
  // SQL migrations install cover metadata. Supply missing local bytes and preserve existing files.
  try {
    await copyFile(source, `.local-poc/media/${pathname}`, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
await db.bookmark.upsert({
  where: {
    userId_recipeId: {
      userId: demoId("author", 1),
      recipeId: demoId("recipe", 2),
    },
  },
  create: {
    userId: demoId("author", 1),
    recipeId: demoId("recipe", 2),
  },
  update: {},
});
console.log(
  "Local demo recipes ready. Demo accounts: rachel@savor.local / grace@savor.local; password: SavorKitchen2026!",
);
await db.$disconnect();
