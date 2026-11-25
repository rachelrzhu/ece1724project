import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { unitSymbols } from "@/lib/recipes/measurements";

const target = "20261125000000_ingredient_catalog";
const root = "prisma/migrations";
const db = new PGlite();
let recipeId: string;

beforeAll(async () => {
  await db.exec("CREATE SCHEMA recipe_test; BEGIN; SET LOCAL search_path TO recipe_test");
  const directories = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name < target)
    .map(entry => entry.name).sort();
  for (const directory of directories) await db.exec(readFileSync(`${root}/${directory}/migration.sql`, "utf8").replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
  const recipe = await db.query<{ id: string }>("SELECT id FROM recipes LIMIT 1");
  recipeId = recipe.rows[0].id;
  await db.query(`INSERT INTO recipe_ingredients (recipe_id,position,name,canonical_name,quantity,unit)
    VALUES ($1, 95, 'Water', 'wrong', 0.25, 'Millilitres'),
           ($1, 96, 'WATER', 'WATER', 0.012345, 'family scoop')`, [recipeId]);
  await db.exec(readFileSync(`${root}/${target}/migration.sql`, "utf8"));
  await db.exec(readFileSync(`${root}/20261125010000_recipe_likes_view/migration.sql`, "utf8"));
  await db.exec("COMMIT; SET search_path TO recipe_test");
});
afterAll(() => db.close());

it("seeds every menu choice, keeps custom units private to their rows and rejects unknown units", async () => {
  const menu = await db.query<{ symbol: string }>("SELECT symbol FROM measurement_units WHERE menu_position IS NOT NULL ORDER BY menu_position");
  expect(menu.rows.map(unit => unit.symbol)).toEqual(unitSymbols);
  await expect(db.query("UPDATE recipe_ingredients SET unit='invented' WHERE recipe_id=$1 AND position=95", [recipeId]))
    .rejects.toThrow(/recipe_ingredients_unit_fkey/);
  const rows = await db.query(`SELECT unit, quantity::float8, canonical_name FROM recipe_ingredients
    WHERE recipe_id=$1 AND position>=95 ORDER BY position`, [recipeId]);
  expect(rows.rows).toEqual([
    { unit: "mL", quantity: 0.25, canonical_name: "water" },
    { unit: "family scoop", quantity: 0.012345, canonical_name: "water" },
  ]);
});

it("links name variants to one identity for inserts and renames and keeps dietary classifications", async () => {
  await db.query(`INSERT INTO recipe_ingredients (recipe_id,position,name,note)
    VALUES ($1,97,'Water','To taste'),($1,98,' WATER ','To taste'),($1,99,'water','To taste')`, [recipeId]);
  const result = await db.query(`SELECT p.canonical_name, p.classification, count(*)::int AS uses FROM recipe_ingredients i
    JOIN ingredient_profiles p USING(canonical_name) WHERE i.recipe_id=$1 AND i.position>=97 GROUP BY 1,2`, [recipeId]);
  expect(result.rows).toEqual([{ canonical_name: "water", classification: "VEGAN", uses: 3 }]);
  await db.query("UPDATE recipe_ingredients SET name='Mystery seasoning' WHERE recipe_id=$1 AND position=98", [recipeId]);
  expect((await db.query("SELECT classification FROM ingredient_profiles WHERE canonical_name='mystery seasoning'")).rows)
    .toEqual([{ classification: "UNKNOWN" }]);
});

it("runs later migrations and schema-qualified Prisma-style writes in the owning schema", async () => {
  await db.transaction(async tx => {
    await tx.exec("SET LOCAL search_path TO public");
    const view = await tx.query("SELECT to_regclass('recipe_test.recipe_likes') IS NOT NULL AS in_schema, to_regclass('public.recipe_likes') IS NULL AS public_clear");
    expect(view.rows).toEqual([{ in_schema: true, public_clear: true }]);
    const cook = await tx.query("INSERT INTO recipe_test.users (email,name) VALUES ('schema@example.test','Schema Cook') RETURNING username");
    expect(cook.rows).toEqual([{ username: "schema_cook" }]);
    await tx.query("INSERT INTO recipe_test.recipe_ingredients (recipe_id,position,name,note) VALUES ($1,94,'Smoked Spice','To taste')", [recipeId]);
    const profile = await tx.query("SELECT canonical_name FROM recipe_test.ingredient_profiles WHERE canonical_name='smoked spice'");
    expect(profile.rows).toEqual([{ canonical_name: "smoked spice" }]);
  });
});
