import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { coverId, otherUserId, ownerId, recipeId } from "./fixtures";

let database: PGlite;

beforeAll(async () => {
  database = new PGlite();
  await database.exec(readFileSync("prisma/migrations/0_baseline/migration.sql", "utf8"));
  await database.query("INSERT INTO users (id, email) VALUES ($1, 'owner@example.test'), ($2, 'reader@example.test')", [ownerId, otherUserId]);
  await database.query("INSERT INTO files (id, owner_id, name, pathname, content_type, size) VALUES ($1, $2, 'cover.png', 'private/cover.png', 'image/png', 100)", [coverId, ownerId]);
  await database.exec(readFileSync("prisma/migrations/20261108000000_recipe_domain/migration.sql", "utf8"));
});

afterAll(async () => { await database?.close(); });

const createRecipeSql = "INSERT INTO recipes (id, author_id, title, description, base_servings, prep_minutes, cook_minutes, difficulty) VALUES ($1, $2, 'Bread', 'Everyday bread', $3, 10, 30, 'EASY')";

beforeEach(async () => {
  await database.exec("TRUNCATE recipes CASCADE");
  await database.query(createRecipeSql, [recipeId, ownerId, 4]);
});

describe("PostgreSQL migrations", () => {
  it("preserves existing profile and file rows when adding recipe tables", async () => {
    const { rows } = await database.query("SELECT id, owner_id, size FROM files WHERE id = $1", [coverId]);
    expect(rows).toEqual([{ id: coverId, owner_id: ownerId, size: 100 }]);
  });

  it("retains the positive file size constraint", async () => {
    await expect(database.query("UPDATE files SET size = 0 WHERE id = $1", [coverId])).rejects.toThrow(/files_size_positive/);
  });

  it("rejects zero servings and defaults recipes to private", async () => {
    const invalidRecipeId = "00000000-0000-4000-8000-000000000005";
    await expect(database.query(createRecipeSql, [invalidRecipeId, ownerId, 0])).rejects.toThrow(/recipes_servings_range/);
    const { rows } = await database.query("SELECT visibility FROM recipes WHERE id = $1", [recipeId]);
    expect(rows).toEqual([{ visibility: "PRIVATE" }]);
  });

  it("prevents duplicate bookmarks", async () => {
    await database.query("INSERT INTO bookmarks (user_id, recipe_id) VALUES ($1, $2)", [otherUserId, recipeId]);
    await expect(database.query("INSERT INTO bookmarks (user_id, recipe_id) VALUES ($1, $2)", [otherUserId, recipeId])).rejects.toThrow(/bookmarks_pkey/);
  });

  it("rolls back recipe and ingredient rows when a later step fails", async () => {
    const failedRecipeId = "00000000-0000-4000-8000-000000000005";
    await expect(database.transaction(async (transaction) => {
      await transaction.query(createRecipeSql, [failedRecipeId, ownerId, 4]);
      await transaction.query("INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity, unit) VALUES ($1, 0, 'Flour', 'flour', 400, 'g')", [failedRecipeId]);
      await transaction.query("INSERT INTO recipe_steps (recipe_id, position, instruction) VALUES ($1, 0, '')", [failedRecipeId]);
    })).rejects.toThrow(/recipe_steps_instruction_required/);
    for (const table of ["recipes", "recipe_ingredients"]) {
      const column = table === "recipes" ? "id" : "recipe_id";
      const result = await database.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${column} = $1`, [failedRecipeId]);
      expect(result.rows).toEqual([{ count: 0 }]);
    }
  });

  it("enforces ingredient measurement and ordering constraints", async () => {
    await expect(database.query("INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity) VALUES ($1, 0, 'Flour', 'flour', 1)", [recipeId])).rejects.toThrow(/recipe_ingredients_measurement/);
    await database.query("INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity, unit) VALUES ($1, 0, 'Flour', 'flour', 400.123456, 'g')", [recipeId]);
    const { rows } = await database.query("SELECT quantity::text FROM recipe_ingredients WHERE recipe_id = $1", [recipeId]);
    expect(rows).toEqual([{ quantity: "400.123456" }]);
    await expect(database.query("INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, note) VALUES ($1, 0, 'Salt', 'salt', 'to taste')", [recipeId])).rejects.toThrow(/recipe_ingredients_recipe_id_position_key/);
  });

  it("deletes recipe children and bookmarks while retaining the owned file", async () => {
    await database.query("INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, note) VALUES ($1, 0, 'Salt', 'salt', 'to taste')", [recipeId]);
    await database.query("INSERT INTO recipe_steps (recipe_id, position, instruction) VALUES ($1, 0, 'Mix')", [recipeId]);
    await database.query("INSERT INTO bookmarks (user_id, recipe_id) VALUES ($1, $2)", [otherUserId, recipeId]);
    await database.query("UPDATE recipes SET cover_file_id = $1 WHERE id = $2", [coverId, recipeId]);
    await database.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
    for (const table of ["bookmarks", "recipe_ingredients", "recipe_steps"]) {
      const result = await database.query(`SELECT count(*)::int AS count FROM ${table} WHERE recipe_id = $1`, [recipeId]);
      expect(result.rows).toEqual([{ count: 0 }]);
    }
    const file = await database.query("SELECT id FROM files WHERE id = $1", [coverId]);
    expect(file.rows).toHaveLength(1);
  });
});
