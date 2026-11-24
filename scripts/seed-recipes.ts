import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
nextEnv.loadEnvConfig(process.cwd());
const { getDatabase } = await import("../lib/db/client");
const { isLocalPoc } = await import("../lib/product/local");
const { productImageStore } = await import("../lib/product/storage");
if (!isLocalPoc())
  throw new Error("Run the recipe seed script against the local test database.");
const db = getDatabase();
const owner = await db.user.upsert({
  where: { email: "rachel@savor.local" },
  update: {},
  create: {
    id: "10000000-0000-4000-8000-000000000001",
    email: "rachel@savor.local",
    name: "Rachel",
  },
});
const grace = await db.user.upsert({
  where: { email: "grace@savor.local" },
  update: {},
  create: {
    id: "10000000-0000-4000-8000-000000000002",
    email: "grace@savor.local",
    name: "Grace",
  },
});
for (const user of [owner, grace]) {
  if (
    !(await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    }))
  )
    await db.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword("SavorKitchen2026!"),
      },
    });
}
type Seed = {
  title: string;
  description: string;
  photo: string;
  servings: number;
  prep: number;
  cook: number;
  ingredients: [string, number | null, string | null, string | null][];
  steps: string[];
};
const data: Seed[] = [
  {
    title: "Lemon & basil pasta",
    description:
      "Lemon zest, garlic and a splash of pasta water make the sauce. Toss in torn basil just before serving.",
    photo: "pasta",
    servings: 4,
    prep: 10,
    cook: 15,
    ingredients: [
      ["Pasta", 400, "g", null],
      ["Fresh basil", 30, "g", null],
      ["Olive oil", 60, "ml", null],
      ["Parmesan", 80, "g", "Finely grated"],
      ["Lemon", 1, "count", "Zest and juice"],
      ["Garlic", 2, "count", "Cloves, finely sliced"],
      ["Sea salt", null, null, "To taste"],
    ],
    steps: [
      "Bring a large pot of generously salted water to a boil. Add the pasta and cook until al dente, following the packet instructions. Reserve a mug of pasta water before draining.",
      "Warm the olive oil in a wide pan over medium-low heat. Add the sliced garlic and stir for 1–2 minutes until fragrant. Keep it pale rather than golden.",
      "Add the drained pasta, lemon zest and juice, and a splash of the reserved pasta water. Toss vigorously until the sauce looks glossy.",
      "Take the pan off the heat. Fold in the parmesan and torn basil, loosening with a little more pasta water as needed. Taste, season, and serve right away.",
    ],
  },
  {
    title: "The everyday green bowl",
    description:
      "Roast the chickpeas until crisp, then toss them with cucumber, greens and lemon dressing.",
    photo: "salad",
    servings: 2,
    prep: 15,
    cook: 20,
    ingredients: [
      ["Chickpeas", 400, "g", "Drained"],
      ["Mixed greens", 150, "g", null],
      ["Cucumber", 1, "count", null],
      ["Olive oil", 30, "ml", null],
      ["Lemon juice", 30, "ml", null],
      ["Salt", null, null, "To taste"],
    ],
    steps: [
      "Pat the chickpeas dry. Toss with half the oil and a pinch of salt. Roast at 200°C for 20 minutes until crisp.",
      "Wash and dry the greens. Slice the cucumber and arrange in bowls.",
      "Whisk the remaining oil with lemon juice. Add the warm chickpeas to the greens, drizzle with dressing, and toss.",
    ],
  },
  {
    title: "Slow Sunday pancakes",
    description:
      "A stack of small, buttery pancakes to serve with fruit or maple syrup.",
    photo: "pancakes",
    servings: 4,
    prep: 10,
    cook: 15,
    ingredients: [
      ["Plain flour", 400, "g", null],
      ["Milk", 500, "ml", null],
      ["Eggs", 2, "count", null],
      ["Sugar", 30, "g", null],
      ["Baking powder", 2, "tsp", null],
      ["Butter", 40, "g", "Melted"],
    ],
    steps: [
      "Whisk the flour, sugar, and baking powder in a large bowl.",
      "In a second bowl, beat the eggs with the milk and cooled melted butter. Fold into the dry ingredients just until combined; a few lumps are fine.",
      "Warm a lightly buttered frying pan over medium heat. Add small ladles of batter. Cook until bubbles appear, then flip and cook the other side until golden.",
      "Serve warm with fruit and maple syrup.",
    ],
  },
  {
    title: "Roasted tomato soup",
    description:
      "Roast the tomatoes and onion before blending them with stock. Stir in the cream at the end.",
    photo: "soup",
    servings: 4,
    prep: 10,
    cook: 40,
    ingredients: [
      ["Tomatoes", 1000, "g", null],
      ["Onion", 1, "count", null],
      ["Vegetable stock", 600, "ml", null],
      ["Cream", 100, "ml", null],
      ["Olive oil", 30, "ml", null],
      ["Salt", null, null, "To taste"],
    ],
    steps: [
      "Heat the oven to 200°C. Halve the tomatoes and quarter the onion. Place on a tray with the olive oil and season.",
      "Roast for 30 minutes until softened and caramelized at the edges.",
      "Transfer to a pot, add the stock, and simmer for 10 minutes. Blend until smooth, then stir in the cream. Taste and season.",
    ],
  },
  {
    title: "Avocado toast, a little extra",
    description:
      "Toasted sourdough topped with lemony avocado, a seven-minute egg and chili flakes.",
    photo: "toast",
    servings: 2,
    prep: 10,
    cook: 7,
    ingredients: [
      ["Sourdough bread", 2, "count", "Slices"],
      ["Avocado", 1, "count", null],
      ["Eggs", 2, "count", null],
      ["Lemon juice", 15, "ml", null],
      ["Chili flakes", null, null, "A pinch"],
    ],
    steps: [
      "Bring a small saucepan of water to a gentle boil. Lower in the eggs and cook for 7 minutes. Cool briefly under cold water and peel.",
      "Toast the sourdough. Mash the avocado with lemon juice and a pinch of salt.",
      "Spread the avocado on the toast, top with halved eggs, and finish with chili flakes.",
    ],
  },
  {
    title: "Ginger sesame grain bowl",
    description:
      "Brown rice, steamed broccoli and carrots with a soy, ginger and sesame dressing.",
    photo: "bowl",
    servings: 3,
    prep: 15,
    cook: 20,
    ingredients: [
      ["Brown rice", 240, "g", null],
      ["Broccoli", 300, "g", null],
      ["Carrot", 2, "count", null],
      ["Soy sauce", 30, "ml", null],
      ["Sesame oil", 15, "ml", null],
      ["Ginger", 15, "g", "Finely grated"],
    ],
    steps: [
      "Cook the rice according to the package directions.",
      "Cut the broccoli into florets and slice the carrots. Steam for 5–7 minutes until tender with a little bite.",
      "Whisk the soy sauce, sesame oil, and ginger. Divide the warm rice and vegetables among bowls and spoon over the dressing.",
    ],
  },
  {
    title: "Basil pesto for the week",
    description:
      "Basil pesto with toasted pine nuts, garlic and Parmesan. Spoon it over pasta or spread it on toast.",
    photo: "pasta",
    servings: 6,
    prep: 10,
    cook: 0,
    ingredients: [
      ["Basil", 60, "g", null],
      ["Olive oil", 120, "ml", null],
      ["Parmesan", 60, "g", null],
      ["Pine nuts", 40, "g", null],
      ["Garlic", 1, "count", "Clove"],
    ],
    steps: [
      "Toast the pine nuts in a dry pan until lightly golden. Leave to cool.",
      "Blend the basil, garlic, pine nuts, and parmesan. Stream in the olive oil until you reach a loose paste. Season to taste.",
    ],
  },
  {
    title: "Rachel’s kitchen notes",
    description:
      "Small-batch tomato soup for two, made with roasted tomatoes and vegetable stock.",
    photo: "soup",
    servings: 2,
    prep: 10,
    cook: 20,
    ingredients: [
      ["Tomatoes", 450, "g", null],
      ["Vegetable stock", 250, "ml", null],
      ["Salt", null, null, "To taste"],
    ],
    steps: [
      "Roast the tomatoes until tender, then simmer with stock and blend. Taste and adjust before serving.",
    ],
  },
];
// Stable IDs let setup skip recipes that were seeded on an earlier run.
for (const [index, recipe] of data.entries()) {
  const id = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  if (await db.recipe.findUnique({ where: { id } })) continue;
  const author = index % 2 === 0 || index === 7 ? owner : grace;
  const coverId = `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  const pathname = `seed/${coverId}.jpg`;
  const bytes = await readFile(`public/images/${recipe.photo}.jpg`);
  await productImageStore().put(pathname, bytes, "image/jpeg");
  await db.$transaction(async (tx) => {
    await tx.storedFile.create({
      data: {
        id: coverId,
        ownerId: author.id,
        pathname,
        name: `${recipe.photo}.jpg`,
        contentType: "image/jpeg",
        size: bytes.length,
      },
    });
    await tx.recipe.create({
      data: {
        id,
        authorId: author.id,
        title: recipe.title,
        description: recipe.description,
        baseServings: recipe.servings,
        prepMinutes: recipe.prep,
        cookMinutes: recipe.cook,
        difficulty: "EASY",
        visibility: index === 7 ? "PRIVATE" : "PUBLIC",
        coverFileId: coverId,
        createdAt: new Date(Date.UTC(2026, 10, 8, 12, 0, 0) - index * 60000),
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
      userId: owner.id,
      recipeId: "20000000-0000-4000-8000-000000000002",
    },
  },
  create: {
    userId: owner.id,
    recipeId: "20000000-0000-4000-8000-000000000002",
  },
  update: {},
});
console.log(
  "Local demo recipes ready. Demo accounts: rachel@savor.local / grace@savor.local; password: SavorKitchen2026!",
);
await db.$disconnect();
