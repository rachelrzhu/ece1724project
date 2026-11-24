import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { demoAuthors, demoId, demoRecipes } from "./demo-recipes";

nextEnv.loadEnvConfig(process.cwd());
const { getDatabase } = await import("../lib/db/client");
const { isLocalPoc } = await import("../lib/product/local");
const { productImageStore } = await import("../lib/product/storage");
if (!isLocalPoc())
  throw new Error("Run the recipe seed script against the local test database.");
const db = getDatabase();
for (const { slot, localEmail: email, name } of demoAuthors) {
  const id = demoId("author", slot);
  const user = await db.user.upsert({
    where: { id, email },
    create: { id, email, name },
    update: {},
    select: { name: true },
  });
  if (user.name !== name) await db.user.update({ where: { id, email }, data: { name } });
  // Only the two local test logins need credentials.
  if (slot > 2) continue;
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

for (const recipe of demoRecipes) {
  const id = demoId("recipe", recipe.slot);
  const authorId = demoId("author", recipe.authorSlot);
  const coverId = demoId("cover", recipe.slot);
  if (await db.recipe.findUnique({ where: { id }, select: { id: true } })) {
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
    continue;
  }
  const pathname = `seed/${coverId}.jpg`;
  const bytes = await readFile(new URL(`../public/images/${recipe.photo}.jpg`, import.meta.url));
  await productImageStore().put(pathname, bytes, "image/jpeg");
  await db.$transaction(async (tx) => {
    await tx.storedFile.create({
      data: {
        id: coverId,
        ownerId: authorId,
        pathname,
        name: `${recipe.photo}.jpg`,
        contentType: "image/jpeg",
        size: bytes.length,
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
