import { readFileSync, readdirSync, statSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { demoAuthors, demoId, demoRecipes } from "../scripts/demo-recipes";

const migrationName = "20261124050000_public_recipe_catalog";
const migrationRoot = "prisma/migrations";
const catalog = demoRecipes.filter(recipe => !recipe.isPrivate && recipe.slot <= 17);
const catalogSql = () => readFileSync(`${migrationRoot}/${migrationName}/migration.sql`, "utf8");
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const earlier = readdirSync(migrationRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name < migrationName)
    .map(entry => entry.name).sort();
  for (const migration of earlier) {
    await db.exec(readFileSync(`${migrationRoot}/${migration}/migration.sql`, "utf8"));
  }
});
beforeEach(async () => { await db.exec("TRUNCATE users CASCADE"); });
afterAll(async () => { await db?.close(); });

it("imports the public catalog with its covers and ordered ingredients and steps", async () => {
  await db.exec(catalogSql());
  const cooks = await db.query<{ id: string; name: string; email: string }>("SELECT id, name, email FROM users ORDER BY id");
  expect(cooks.rows.map(({ id, name }) => ({ id, name }))).toEqual(
    demoAuthors.map(({ slot, name }) => ({ id: demoId("author", slot), name })),
  );
  expect(cooks.rows.every(({ email }) => email.endsWith("@public-fixtures.savor.invalid"))).toBe(true);
  const recipes = await db.query(`
    SELECT r.id, r.title, r.description, r.base_servings::float8 AS servings, r.prep_minutes AS prep,
           r.cook_minutes AS cook, r.difficulty, r.visibility, r.author_id, r.cover_file_id,
           f.name, f.pathname, f.content_type, f.size
    FROM recipes r
    LEFT JOIN files f ON f.id = r.cover_file_id AND f.owner_id = r.author_id
    ORDER BY r.created_at DESC, r.id DESC
  `);
  expect(recipes.rows).toEqual(catalog.map(recipe => {
    const coverId = demoId("cover", recipe.slot);
    const name = `${recipe.photo}.jpg`;
    return {
      id: demoId("recipe", recipe.slot), title: recipe.title, description: recipe.description,
      servings: recipe.servings, prep: recipe.prep, cook: recipe.cook, difficulty: "EASY", visibility: "PUBLIC",
      author_id: demoId("author", recipe.authorSlot), cover_file_id: coverId, name,
      pathname: `seed/${coverId}.jpg`, content_type: "image/jpeg", size: statSync(`public/images/${name}`).size,
    };
  }));
  const ingredients = await db.query(`
    SELECT recipe_id, position, name, canonical_name, quantity::float8 AS quantity, unit, note
    FROM recipe_ingredients ORDER BY recipe_id, position
  `);
  expect(ingredients.rows).toEqual(catalog.flatMap(recipe =>
    recipe.ingredients.map(([name, quantity, unit, note], position) => ({
      recipe_id: demoId("recipe", recipe.slot), position, name, canonical_name: name.toLowerCase(), quantity, unit, note,
    })),
  ));
  const steps = await db.query("SELECT recipe_id, position, instruction FROM recipe_steps ORDER BY recipe_id, position");
  expect(steps.rows).toEqual(catalog.flatMap(recipe =>
    recipe.steps.map((instruction, position) => ({ recipe_id: demoId("recipe", recipe.slot), position, instruction })),
  ));
  for (const table of ["accounts", "sessions", "bookmarks"]) {
    expect((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows).toEqual([{ n: 0 }]);
  }
});

it("preserves edits, visibility and child identities when replayed", async () => {
  await db.exec(catalogSql());
  const recipeId = demoId("recipe", 1);
  await db.query("UPDATE recipes SET visibility = 'PRIVATE', title = 'My edited recipe', cover_file_id = NULL WHERE id = $1", [recipeId]);
  await db.query("UPDATE recipe_steps SET instruction = 'An edited step' WHERE recipe_id = $1 AND position = 0", [recipeId]);
  await db.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1 AND position = 0", [recipeId]);
  const snapshot = async () => {
    const snapshots = [];
    for (const table of ["users", "recipes", "recipe_steps", "recipe_ingredients", "files"]) {
      snapshots.push((await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
    }
    return snapshots;
  };
  const before = await snapshot();
  await db.exec(catalogSql());
  expect(await snapshot()).toEqual(before);
});

it("fills missing recipes when an earlier seed left its cook and cover in place", async () => {
  await db.exec(catalogSql());
  const recipeId = demoId("recipe", 17);
  await db.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
  await db.query("UPDATE users SET email = 'nina@savor.local', name = 'Edited cook' WHERE id = $1", [demoId("author", 3)]);
  await db.exec(catalogSql());
  expect((await db.query("SELECT name, email FROM users WHERE id = $1", [demoId("author", 3)])).rows)
    .toEqual([{ name: "Edited cook", email: "nina@savor.local" }]);
  expect((await db.query("SELECT cover_file_id FROM recipes WHERE id = $1", [recipeId])).rows)
    .toEqual([{ cover_file_id: demoId("cover", 17) }]);
  expect((await db.query("SELECT count(*)::int AS n FROM recipe_steps WHERE recipe_id = $1", [recipeId])).rows)
    .toEqual([{ n: 6 }]);
});

it("leaves an existing account and database contents intact on a cook UUID collision", async () => {
  const occupiedId = demoId("author", 8);
  await db.query("INSERT INTO users (id, email) VALUES ($1, 'existing@example.test')", [occupiedId]);
  await expect(db.exec(catalogSql())).rejects.toThrow();
  expect((await db.query("SELECT id, email FROM users")).rows).toEqual([{ id: occupiedId, email: "existing@example.test" }]);
  expect((await db.query("SELECT id FROM recipes")).rows).toEqual([]);
  expect((await db.query("SELECT id FROM files")).rows).toEqual([]);
});
