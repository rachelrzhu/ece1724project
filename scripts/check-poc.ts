import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
const { isLocalPoc } = await import("../lib/product/local");
const { getDatabase } = await import("../lib/db/client");
const { createRecipeService } = await import("../lib/recipes/service");
const { createImageService } = await import("../lib/storage/service");
const { productImageStore } = await import("../lib/product/storage");
if (!isLocalPoc())
  throw new Error(
    "This verification only runs against the local POC database.",
  );
const origin = process.env.BETTER_AUTH_URL!;
const db = getDatabase();
const checks: string[] = [];
const accountEmail = `qa-${randomUUID()}@savor.local`;
let qaId: string | undefined,
  recipeId: string | undefined,
  fileId: string | undefined,
  pathname: string | undefined;
const check = (name: string) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
async function auth(path: string, body: unknown, cookie?: string) {
  const response = await fetch(`${origin}/api/auth/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return response;
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function media(id: string, cookie?: string) {
  return fetch(`${origin}/api/images/${id}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}
try {
  const signup = await auth("sign-up/email", {
    email: accountEmail,
    password: "LocalQaPassword2026!",
    name: "Disposable QA cook",
  });
  assert.equal(signup.status, 200);
  const registered = await signup.json();
  qaId = registered.user.id;
  const qaCookie = cookies(signup);
  assert(qaCookie.includes("session_token"));
  check("Email registration creates a persisted account and session");
  assert.equal(
    (await db.account.findFirstOrThrow({ where: { userId: qaId } })).providerId,
    "credential",
  );
  const invalid = await auth("sign-in/email", {
    email: accountEmail,
    password: "wrong-password",
  });
  assert.equal(invalid.status, 401);
  check("Invalid password is rejected");
  const rachelResponse = await auth("sign-in/email", {
    email: "rachel@savor.local",
    password: "SavorKitchen2026!",
  });
  assert.equal(rachelResponse.status, 200);
  const ownerCookie = cookies(rachelResponse);
  const owner = await db.user.findUniqueOrThrow({
    where: { email: "rachel@savor.local" },
  });
  const ownerReader = async () => ({ user: { id: owner.id } }),
    qaReader = async () => ({ user: { id: qaId! } });
  const ownerService = createRecipeService({
      database: getDatabase,
      readSession: ownerReader,
    }),
    qaService = createRecipeService({
      database: getDatabase,
      readSession: qaReader,
    }),
    anonymous = createRecipeService({
      database: getDatabase,
      readSession: async () => null,
    });
  const input = {
    title: "Disposable POC verification recipe",
    description: "Only created by the local verification script.",
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    difficulty: "EASY",
    visibility: "PRIVATE",
    ingredients: [
      { name: "Flour", quantity: 450, unit: "g" },
      { name: "Salt", quantity: null, unit: null, note: "To taste" },
    ],
    steps: [{ instruction: "Mix." }, { instruction: "Cook." }],
  };
  await assert.rejects(() => anonymous.create(input));
  check("Anonymous recipe mutations are rejected");
  const file = await createImageService({
    database: getDatabase,
    readSession: ownerReader,
    storage: productImageStore(),
  }).upload({
    name: "qa-photo.jpg",
    bytes: await readFile("public/images/pancakes.jpg"),
  });
  fileId = file.id;
  pathname = (await db.storedFile.findUniqueOrThrow({ where: { id: file.id } }))
    .pathname;
  recipeId = (await ownerService.create({ ...input, coverFileId: file.id })).id;
  const recipe = await ownerService.getById(recipeId);
  assert.equal(recipe?.ingredients.length, 2);
  assert.equal(recipe?.steps.length, 2);
  assert.equal(recipe?.ingredients[0].quantity, "450");
  check(
    "Prisma persists ordered ingredients, notes, steps and cover association",
  );
  assert.equal(await qaService.getById(recipeId), null);
  assert.equal(await anonymous.getById(recipeId), null);
  assert.equal(await qaService.update(recipeId, input), null);
  assert.equal(await qaService.remove(recipeId), false);
  check("A second account cannot read, update or delete a private recipe");
  await assert.rejects(() =>
    qaService.create({ ...input, coverFileId: file.id }),
  );
  check("A second account cannot attach another user’s image");
  assert.equal((await media(file.id)).status, 404);
  assert.equal((await media(file.id, qaCookie)).status, 404);
  const ownMedia = await media(file.id, ownerCookie);
  assert.equal(ownMedia.status, 200);
  assert.match(ownMedia.headers.get("cache-control")!, /no-store/);
  check("Private image delivery is owner-only and never shared-cacheable");
  await ownerService.update(recipeId, {
    ...input,
    coverFileId: file.id,
    visibility: "PUBLIC",
  });
  assert(await anonymous.getById(recipeId));
  assert.equal((await media(file.id)).status, 200);
  check("Publication opens the recipe and photo to visitors");
  await db.bookmark.upsert({
    where: { userId_recipeId: { userId: qaId!, recipeId } },
    create: { userId: qaId!, recipeId },
    update: {},
  });
  await db.bookmark.upsert({
    where: { userId_recipeId: { userId: qaId!, recipeId } },
    create: { userId: qaId!, recipeId },
    update: {},
  });
  assert.equal(
    await db.bookmark.count({ where: { userId: qaId!, recipeId } }),
    1,
  );
  check("Saving a recipe is idempotent");
  await ownerService.update(recipeId, {
    ...input,
    coverFileId: file.id,
    visibility: "PRIVATE",
  });
  assert.equal((await media(file.id, qaCookie)).status, 404);
  assert.equal(await qaService.getById(recipeId), null);
  check("Making a saved recipe private revokes detail and media access");
  assert.equal(await ownerService.remove(recipeId), true);
  assert.equal(await db.recipeIngredient.count({ where: { recipeId } }), 0);
  assert.equal(await db.recipeStep.count({ where: { recipeId } }), 0);
  assert.equal(await db.bookmark.count({ where: { recipeId } }), 0);
  check("Deletion removes recipe children and saved references");
  recipeId = undefined;
  const logout = await auth("sign-out", {}, qaCookie);
  assert.equal(logout.status, 200);
  const oldSession = await fetch(`${origin}/api/auth/get-session`, {
    headers: { Cookie: qaCookie },
  });
  assert.equal(await oldSession.json(), null);
  check(
    "Sign-out invalidates the persisted session, including a replayed cookie",
  );
  check(
    "All verification used the loopback PostgreSQL database and local media",
  );
} finally {
  if (recipeId) await db.recipe.deleteMany({ where: { id: recipeId } });
  if (fileId) await db.storedFile.deleteMany({ where: { id: fileId } });
  if (pathname) await productImageStore().remove(pathname);
  if (qaId) await db.user.deleteMany({ where: { id: qaId } });
  await db.$disconnect();
}
await mkdir(".local-poc", { recursive: true });
await writeFile(
  ".local-poc/integration-results.json",
  JSON.stringify(
    { date: new Date().toISOString(), checks, passed: checks.length },
    null,
    2,
  ) + "\n",
);
console.log(
  `${checks.length} local integration checks passed; disposable account, recipe and image removed.`,
);
