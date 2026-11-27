import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const migration = "20261125030000_multilingual_ingredients";
const pantryMigration = "20261126000000_common_ingredient_translations";
const root = "prisma/migrations";
const db = new PGlite();
let recipeId: string;
const fishIngredients = [
  ["Plain breadcrumbs", "原味面包糠", "Chapelure nature"],
  ["Parmesan cheese", "帕尔马干酪", "Parmesan"],
  ["Dried thyme", "干百里香", "Thym séché"],
  ["Onion powder", "洋葱粉", "Poudre d’oignon"],
  ["Paprika", "红椒粉", "Paprika"],
  ["White fish fillets", "白肉鱼柳", "Filets de poisson blanc"],
  ["Vegetable oil", "植物油", "Huile végétale"],
];

beforeAll(async () => {
  await db.exec("CREATE SCHEMA multilingual; BEGIN; SET LOCAL search_path TO multilingual");
  const directories = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name < migration)
    .map(entry => entry.name).sort();
  for (const name of directories) {
    const sql = readFileSync(`${root}/${name}/migration.sql`, "utf8");
    await db.exec(sql.replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
  }
  recipeId = (await db.query<{ id: string }>("SELECT id FROM recipes LIMIT 1")).rows[0].id;
  await db.query(`INSERT INTO recipe_ingredients (recipe_id, position, name, quantity, unit, note)
    VALUES ($1, 95, '鸡蛋', 2, 'count', 'reserve one'), ($1, 96, 'ŒUFS', 3, 'count', NULL),
           ($1, 97, 'House seasoning', NULL, NULL, 'to taste')`, [recipeId]);
  await db.exec(`INSERT INTO ingredient_allergens (canonical_name, allergen) VALUES ('鸡蛋', 'SESAME');
    UPDATE ingredient_profiles SET classification = 'VEGETARIAN' WHERE canonical_name = '鸡蛋';
    UPDATE ingredient_profiles SET classification = 'UNKNOWN' WHERE canonical_name IN ('eggs','egg');`);
  await db.exec(readFileSync(`${root}/${migration}/migration.sql`, "utf8"));
  for (const [index, [name]] of fishIngredients.entries()) {
    await db.query(`INSERT INTO recipe_ingredients (recipe_id, position, name, quantity, unit)
      VALUES ($1, $2, $3, 1, 'g')`, [recipeId, index + 30, name]);
  }
  await db.exec(`INSERT INTO ingredient_allergens (canonical_name, allergen) VALUES ('parmesan cheese', 'SESAME')`);
  await db.exec(readFileSync(`${root}/${pantryMigration}/migration.sql`, "utf8"));
  await db.exec("COMMIT; SET search_path TO multilingual");
});
afterAll(() => db.close());

it("translates every original ingredient of a breaded fish recipe after upgrading", async () => {
  const labels = await db.query(`SELECT i.name, t.zh, t.fr FROM recipe_ingredients i
    LEFT JOIN ingredient_translations t USING (canonical_name)
    WHERE i.recipe_id=$1 AND i.position BETWEEN 30 AND 36 ORDER BY i.position`, [recipeId]);
  expect(labels.rows).toEqual(fishIngredients.map(([name, zh, fr]) => ({ name, zh, fr })));
  const milk = await db.query(`SELECT allergen FROM ingredient_allergens WHERE canonical_name='parmesan' ORDER BY allergen`);
  expect(milk.rows).toEqual([{ allergen: "MILK" }, { allergen: "SESAME" }]);
  const positives = await db.query(`SELECT canonical_name, allergen FROM ingredient_allergens
    WHERE canonical_name IN ('white fish fillets', 'plain breadcrumbs', 'vegetable oil')`);
  expect(positives.rows).toEqual([{ canonical_name: "white fish fillets", allergen: "FISH" }]);
});

it("recognizes translated pantry spellings on edit and leaves qualified substitutes distinct", async () => {
  await db.transaction(async tx => {
    for (const [name, canonical] of [
      ["POUDRE D’OIGNON", "onion powder"], ["原味麵包糠", "plain breadcrumbs"],
      ["Filet de poisson blanc", "white fish fillets"], ["extra-virgin olive oil", "extra virgin olive oil"],
      ["gluten-free plain breadcrumbs", "gluten-free plain breadcrumbs"], ["vegan Parmesan cheese", "vegan parmesan cheese"],
    ]) {
      const result = await tx.query(`UPDATE recipe_ingredients SET name=$1
        WHERE recipe_id=$2 AND position=30 RETURNING canonical_name`, [name, recipeId]);
      expect(result.rows).toEqual([{ canonical_name: canonical }]);
    }
    await tx.query("UPDATE recipe_ingredients SET name=$1 WHERE recipe_id=$2 AND position=30", [fishIngredients[0][0], recipeId]);
  });
});

it("backfills translated identities and preserves recipe labels, quantities, notes and profile evidence", async () => {
  const ingredients = await db.query(`SELECT name, canonical_name, quantity::int, unit, note
    FROM recipe_ingredients WHERE recipe_id=$1 AND position BETWEEN 95 AND 97 ORDER BY position`, [recipeId]);
  expect(ingredients.rows).toEqual([
    { name: "鸡蛋", canonical_name: "egg", quantity: 2, unit: "count", note: "reserve one" },
    { name: "ŒUFS", canonical_name: "egg", quantity: 3, unit: "count", note: null },
    { name: "House seasoning", canonical_name: "house seasoning", quantity: null, unit: null, note: "to taste" },
  ]);
  const egg = await db.query(`SELECT classification, allergen FROM ingredient_profiles
    JOIN ingredient_allergens USING (canonical_name) WHERE canonical_name='egg' ORDER BY allergen`);
  expect(egg.rows).toEqual([
    { classification: "VEGETARIAN", allergen: "EGG" }, { classification: "VEGETARIAN", allergen: "SESAME" },
  ]);
  const missing = await db.query(`SELECT DISTINCT canonical_name FROM recipe_ingredients
    LEFT JOIN ingredient_translations USING (canonical_name) WHERE en IS NULL`);
  expect(missing.rows).toEqual([{ canonical_name: "house seasoning" }]);
});

it("resolves inserts and subsequent renames even with a schema-qualified connection", async () => {
  await db.transaction(async tx => {
    await tx.exec("SET LOCAL search_path TO public");
    const insert = await tx.query(`INSERT INTO multilingual.recipe_ingredients
      (recipe_id, position, name, canonical_name, quantity, unit)
      VALUES ($1, 98, '雞蛋', 'ignored key', 1, 'count') RETURNING canonical_name`, [recipeId]);
    expect(insert.rows).toEqual([{ canonical_name: "egg" }]);
    for (const [name, key] of [
      ["eggs", "egg"], ["OEUF", "egg"], [" Œuf ", "egg"], ["CRE\u0300ME", "cream"],
      ["eggplant", "eggplant"], ["Aubergine", "eggplant"], ["Unlisted seasoning", "unlisted seasoning"],
    ]) {
      const result = await tx.query(`UPDATE multilingual.recipe_ingredients SET name=$1
        WHERE recipe_id=$2 AND position=98 RETURNING name, canonical_name`, [name, recipeId]);
      expect(result.rows).toEqual([{ name, canonical_name: key }]);
    }
  });
});

it("exposes exactly one translated identity for equivalent spellings", async () => {
  const result = await db.query(`SELECT DISTINCT t.canonical_name, t.en, t.zh, t.fr
    FROM ingredient_translations t JOIN ingredient_aliases a USING (canonical_name)
    WHERE a.name IN ('egg', 'eggs', 'oeuf', 'oeufs', '鸡蛋', '雞蛋')`);
  expect(result.rows).toEqual([{ canonical_name: "egg", en: "Egg", zh: "鸡蛋", fr: "Œuf" }]);
  const forms = await db.query(`SELECT ingredient_alias_key('  BLANC   D’ŒUF  ') AS folded`);
  expect(forms.rows).toEqual([{ folded: "blanc d'oeuf" }]);
});

it("finds the same compounds and custom names for equivalent exact searches across languages", async () => {
  await db.exec(`INSERT INTO ingredient_profiles (canonical_name, classification) VALUES
    ('farm eggs', 'UNKNOWN'), ('mélange-d’œufs', 'UNKNOWN'), ('農家雞蛋醬', 'UNKNOWN'),
    ('house eggplant seasoning', 'UNKNOWN'), ('100%_special', 'UNKNOWN')`);
  const matching = async (term: string) => {
    const result = await db.query<{ canonical_name: string }>(
      "SELECT canonical_name FROM matching_ingredient_names($1) ORDER BY canonical_name", [term]);
    return result.rows.map(row => row.canonical_name);
  };
  const eggs = await matching("egg");
  expect(eggs).toEqual(expect.arrayContaining([
    "egg", "egg whites", "egg yolks", "farm eggs", "mélange-d’œufs", "農家雞蛋醬",
  ]));
  expect(eggs).not.toContain("eggplant");
  expect(eggs).not.toContain("house eggplant seasoning");
  for (const term of ["eggs", "OEUF", "ŒUFS", "鸡蛋", "雞蛋"]) expect(await matching(term)).toEqual(eggs);
  expect(await matching("uberg")).toContain("eggplant");
  expect(await matching("ouse seas")).toContain("house seasoning");
  expect(await matching("%_")).toEqual(["100%_special"]);
  expect(await matching("  ")).toEqual([]);
  await db.transaction(async tx => {
    await tx.exec("SET LOCAL search_path TO public");
    const result = await tx.query("SELECT canonical_name FROM multilingual.matching_ingredient_names('雞蛋') ORDER BY canonical_name");
    expect(result.rows).toEqual(eggs.map(canonical_name => ({ canonical_name })));
  });
});
