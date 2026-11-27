import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const migrations = "prisma/migrations";
const categories = "20261126010000_dietary_categories";
const evidence = "20261126020000_dietary_ingredient_evidence";
let recipeId: string;
let authorId: string;

function migrate(directory: string) {
  return db.exec(readFileSync(`${migrations}/${directory}/migration.sql`, "utf8"));
}

beforeAll(async () => {
  const directories = readdirSync(migrations, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name < categories)
    .map(entry => entry.name).sort();
  for (const directory of directories) await migrate(directory);
  const [recipe] = (await db.query<{ id: string; author_id: string }>(
    "SELECT id, author_id FROM recipes LIMIT 1",
  )).rows;
  recipeId = recipe.id;
  authorId = recipe.author_id;
  await db.query(`INSERT INTO dietary_settings (user_id, diet, allergens)
    VALUES ($1, 'VEGETARIAN', ARRAY['SULPHITES','WHEAT_TRITICALE']::"Allergen"[])`, [authorId]);
  await db.query(`INSERT INTO recipe_ingredients (recipe_id, position, name, quantity, unit) VALUES
    ($1, 80, 'Farine de seigle', 125, 'g'), ($1, 81, '鸡胸肉', 300, 'g'),
    ($1, 82, 'Vegan egg noodles', 50, 'g')`, [recipeId]);
  await db.exec("INSERT INTO ingredient_allergens VALUES ('farine de seigle', 'SESAME')");
  await migrate(categories);
  await migrate(evidence);
});

afterAll(() => db.close());

it("upgrades saved settings and ingredients while retaining original recipe text and evidence", async () => {
  const saved = await db.query("SELECT diet, allergens::text[] FROM dietary_settings WHERE user_id=$1", [authorId]);
  expect(saved.rows).toEqual([{ diet: "VEGETARIAN", allergens: ["SULPHITES", "WHEAT_TRITICALE"] }]);

  const ingredients = await db.query(`SELECT name, canonical_name, quantity::int, classification, contains_gluten
    FROM recipe_ingredients JOIN ingredient_profiles USING (canonical_name)
    WHERE recipe_id=$1 AND position BETWEEN 80 AND 82 ORDER BY position`, [recipeId]);
  expect(ingredients.rows).toEqual([
    { name: "Farine de seigle", canonical_name: "rye flour", quantity: 125, classification: "VEGAN", contains_gluten: true },
    { name: "鸡胸肉", canonical_name: "chicken breast", quantity: 300, classification: "MEAT", contains_gluten: false },
    { name: "Vegan egg noodles", canonical_name: "vegan egg noodles", quantity: 50, classification: "UNKNOWN", contains_gluten: null },
  ]);
  expect((await db.query("SELECT allergen FROM ingredient_allergens WHERE canonical_name='rye flour'")).rows)
    .toEqual([{ allergen: "SESAME" }]);
});

it("resolves translated, newly added and existing exact spellings to their allergen evidence", async () => {
  const names = ["花生粉", "Tahina", "Œuf", "Lait sans lactose", "Noix du Brésil", "虾仁", "鳕鱼", "豆浆", "芥末粉"];
  const rows = await db.query(`SELECT n.name, a.allergen FROM unnest($1::text[]) WITH ORDINALITY AS n(name, position)
    JOIN ingredient_aliases i ON i.name=ingredient_alias_key(n.name)
    JOIN ingredient_allergens a ON a.canonical_name=i.canonical_name ORDER BY n.position`, [names]);
  expect(rows.rows).toEqual(["PEANUT", "SESAME", "EGG", "MILK", "TREE_NUT", "CRUSTACEANS_MOLLUSCS", "FISH", "SOY", "MUSTARD"]
    .map((allergen, index) => ({ name: names[index], allergen })));
  const substitute = await db.query(`SELECT canonical_name FROM ingredient_allergens WHERE
    (allergen='MILK' AND canonical_name IN ('soy milk', 'almond milk', 'coconut milk')) OR
    (allergen='EGG' AND canonical_name IN ('eggplant', 'vegan egg noodles')) OR
    (allergen='WHEAT_TRITICALE' AND canonical_name IN ('rye', 'barley', 'buckwheat'))`);
  expect(substitute.rows).toEqual([]);
});

it("records meat, seafood and gluten independently and keeps uncertain products unassessed", async () => {
  const cases = [
    ["beef broth", "MEAT", null], ["chicken stock", "MEAT", null], ["salmon fillets", "SEAFOOD", false],
    ["shrimp", "SEAFOOD", false], ["fish sauce", "SEAFOOD", null], ["tofu", "VEGAN", null],
    ["barley", "VEGAN", true], ["wheat flour", "VEGAN", true], ["whole wheat bread", "UNKNOWN", true],
    ["flour tortillas", "UNKNOWN", true], ["seitan", "UNKNOWN", true], ["vital wheat gluten", "VEGAN", true],
    ["buckwheat", "VEGAN", false], ["glutinous rice flour", "VEGAN", false], ["gluten-free oats", "VEGAN", false],
    ["rolled oats", "VEGAN", null], ["breadcrumbs", "UNKNOWN", null], ["soy sauce", "UNKNOWN", null],
  ] as const;
  const facts = await db.query(`SELECT canonical_name, classification, contains_gluten
    FROM ingredient_profiles WHERE canonical_name=ANY($1::text[]) ORDER BY array_position($1::text[], canonical_name::text)`,
    [cases.map(([name]) => name)]);
  expect(facts.rows).toEqual(cases.map(([canonical_name, classification, contains_gluten]) =>
    ({ canonical_name, classification, contains_gluten })));
});
