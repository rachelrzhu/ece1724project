import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { coverId, otherUserId, ownerId, recipeId } from "./fixtures";

let database: PGlite;
let originalBeforeCopies: { id: string; source_recipe_id: string | null };
let migratedUsernames: string[];

beforeAll(async () => {
  database = new PGlite();
  await database.exec(
    readFileSync("prisma/migrations/0_baseline/migration.sql", "utf8"),
  );
  await database.query(
    "INSERT INTO users (id, email) VALUES ($1, 'owner@example.test'), ($2, 'reader@example.test')",
    [ownerId, otherUserId],
  );
  await database.query(
    "INSERT INTO files (id, owner_id, name, pathname, content_type, size) VALUES ($1, $2, 'cover.png', 'private/cover.png', 'image/png', 100)",
    [coverId, ownerId],
  );
  await database.exec(
    readFileSync(
      "prisma/migrations/20261108000000_recipe_domain/migration.sql",
      "utf8",
    ),
  );
  await database.exec(
    readFileSync(
      "prisma/migrations/20261108120000_authentication/migration.sql",
      "utf8",
    ),
  );
  await database.query(createRecipeSql, [recipeId, ownerId, 4]);
  await database.exec(
    readFileSync("prisma/migrations/20261123000000_recipe_copy_source/migration.sql", "utf8"),
  );
  const { rows } = await database.query<typeof originalBeforeCopies>(
    "SELECT id, source_recipe_id FROM recipes WHERE id = $1", [recipeId],
  );
  [originalBeforeCopies] = rows;
  await database.exec(
    readFileSync("prisma/migrations/20261123010000_dietary_preferences/migration.sql", "utf8"),
  );
  await database.exec(
    readFileSync("prisma/migrations/20261123020000_usernames/migration.sql", "utf8"),
  );
  await database.exec(
    readFileSync("prisma/migrations/20261124000000_username_cooldown/migration.sql", "utf8"),
  );
  await database.exec(
    readFileSync("prisma/migrations/20261124010000_allergen_ingredient_names/migration.sql", "utf8"),
  );
  await database.exec(
    readFileSync("prisma/migrations/20261124020000_name_based_usernames/migration.sql", "utf8"),
  );
  const migrated = await database.query<{ username: string }>(
    "SELECT username FROM users WHERE id IN ($1, $2)", [ownerId, otherUserId],
  );
  migratedUsernames = migrated.rows.map(row => row.username);
});

afterAll(async () => {
  await database?.close();
});

const createRecipeSql =
  "INSERT INTO recipes (id, author_id, title, description, base_servings, prep_minutes, cook_minutes, difficulty) VALUES ($1, $2, 'Bread', 'Everyday bread', $3, 10, 30, 'EASY')";

beforeEach(async () => {
  await database.exec("TRUNCATE recipes CASCADE");
  await database.query(createRecipeSql, [recipeId, ownerId, 4]);
});

describe("PostgreSQL migrations", () => {
  it("preserves existing profile and file rows when adding recipe tables", async () => {
    const { rows } = await database.query(
      "SELECT id, owner_id, size FROM files WHERE id = $1",
      [coverId],
    );
    expect(rows).toEqual([{ id: coverId, owner_id: ownerId, size: 100 }]);
  });

  it("retains the positive file size constraint", async () => {
    await expect(
      database.query("UPDATE files SET size = 0 WHERE id = $1", [coverId]),
    ).rejects.toThrow(/files_size_positive/);
  });

  it("migrates existing recipes and keeps historical provenance after the source is deleted", async () => {
    expect(originalBeforeCopies).toEqual({ id: recipeId, source_recipe_id: null });
    const copyId = "00000000-0000-4000-8000-000000000006";
    await database.query(createRecipeSql, [copyId, otherUserId, 4]);
    await database.query("UPDATE recipes SET source_recipe_id = $1 WHERE id = $2", [recipeId, copyId]);
    await database.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
    const { rows } = await database.query("SELECT id, source_recipe_id FROM recipes WHERE id = $1", [copyId]);
    expect(rows).toEqual([{ id: copyId, source_recipe_id: recipeId }]);
  });

  it("rejects zero servings and defaults recipes to private", async () => {
    const invalidRecipeId = "00000000-0000-4000-8000-000000000005";
    await expect(
      database.query(createRecipeSql, [invalidRecipeId, ownerId, 0]),
    ).rejects.toThrow(/recipes_servings_range/);
    const { rows } = await database.query(
      "SELECT visibility FROM recipes WHERE id = $1",
      [recipeId],
    );
    expect(rows).toEqual([{ visibility: "PRIVATE" }]);
  });

  it("prevents duplicate bookmarks", async () => {
    await database.query(
      "INSERT INTO bookmarks (user_id, recipe_id) VALUES ($1, $2)",
      [otherUserId, recipeId],
    );
    await expect(
      database.query(
        "INSERT INTO bookmarks (user_id, recipe_id) VALUES ($1, $2)",
        [otherUserId, recipeId],
      ),
    ).rejects.toThrow(/bookmarks_pkey/);
  });

  it("rolls back recipe and ingredient rows when a later step fails", async () => {
    const failedRecipeId = "00000000-0000-4000-8000-000000000005";
    await expect(
      database.transaction(async (transaction) => {
        await transaction.query(createRecipeSql, [failedRecipeId, ownerId, 4]);
        await transaction.query(
          "INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity, unit) VALUES ($1, 0, 'Flour', 'flour', 400, 'g')",
          [failedRecipeId],
        );
        await transaction.query(
          "INSERT INTO recipe_steps (recipe_id, position, instruction) VALUES ($1, 0, '')",
          [failedRecipeId],
        );
      }),
    ).rejects.toThrow(/recipe_steps_instruction_required/);
    for (const table of ["recipes", "recipe_ingredients"]) {
      const column = table === "recipes" ? "id" : "recipe_id";
      const result = await database.query(
        `SELECT count(*)::int AS count FROM ${table} WHERE ${column} = $1`,
        [failedRecipeId],
      );
      expect(result.rows).toEqual([{ count: 0 }]);
    }
  });

  it("enforces ingredient measurement and ordering constraints", async () => {
    await expect(
      database.query(
        "INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity) VALUES ($1, 0, 'Flour', 'flour', 1)",
        [recipeId],
      ),
    ).rejects.toThrow(/recipe_ingredients_measurement/);
    await database.query(
      "INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity, unit) VALUES ($1, 0, 'Flour', 'flour', 400.123456, 'g')",
      [recipeId],
    );
    const { rows } = await database.query(
      "SELECT quantity::text FROM recipe_ingredients WHERE recipe_id = $1",
      [recipeId],
    );
    expect(rows).toEqual([{ quantity: "400.123456" }]);
    await expect(
      database.query(
        "INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, note) VALUES ($1, 0, 'Salt', 'salt', 'to taste')",
        [recipeId],
      ),
    ).rejects.toThrow(/recipe_ingredients_recipe_id_position_key/);
  });

  it("deletes recipe children and bookmarks while retaining the owned file", async () => {
    await database.query(
      "INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, note) VALUES ($1, 0, 'Salt', 'salt', 'to taste')",
      [recipeId],
    );
    await database.query(
      "INSERT INTO recipe_steps (recipe_id, position, instruction) VALUES ($1, 0, 'Mix')",
      [recipeId],
    );
    await database.query(
      "INSERT INTO bookmarks (user_id, recipe_id) VALUES ($1, $2)",
      [otherUserId, recipeId],
    );
    await database.query(
      "UPDATE recipes SET cover_file_id = $1 WHERE id = $2",
      [coverId, recipeId],
    );
    await database.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
    for (const table of ["bookmarks", "recipe_ingredients", "recipe_steps"]) {
      const result = await database.query(
        `SELECT count(*)::int AS count FROM ${table} WHERE recipe_id = $1`,
        [recipeId],
      );
      expect(result.rows).toEqual([{ count: 0 }]);
    }
    const file = await database.query("SELECT id FROM files WHERE id = $1", [
      coverId,
    ]);
    expect(file.rows).toHaveLength(1);
  });
});

describe("additive Better Auth migration", () => {
  it("preserves existing users and adds defaults without changing their identity", async () => {
    const result = await database.query(
      "SELECT id, email_verified, image, updated_at IS NOT NULL AS has_timestamp FROM users WHERE id = $1",
      [ownerId],
    );
    expect(result.rows).toEqual([
      { id: ownerId, email_verified: false, image: null, has_timestamp: true },
    ]);
  });
  it("enforces unique session tokens", async () => {
    await database.query(
      "INSERT INTO sessions (token,user_id,expires_at,updated_at) VALUES ('migration-session',$1,now()+interval '1 day',now())",
      [ownerId],
    );
    await expect(
      database.query(
        "INSERT INTO sessions (token,user_id,expires_at,updated_at) VALUES ('migration-session',$1,now()+interval '1 day',now())",
        [ownerId],
      ),
    ).rejects.toThrow(/sessions_token_key/);
  });
  it("cascades auth records when an otherwise unreferenced user is removed", async () => {
    const id = "40000000-0000-4000-8000-000000000099";
    await database.query(
      "INSERT INTO users (id,email) VALUES ($1,'auth-only@example.test')",
      [id],
    );
    await database.query(
      "INSERT INTO accounts (user_id,account_id,provider_id,updated_at) VALUES ($1,$2,'credential',now())",
      [id, id],
    );
    await database.query(
      "INSERT INTO sessions (user_id,token,expires_at,updated_at) VALUES ($1,'auth-only-session',now()+interval '1 day',now())",
      [id],
    );
    await database.query("DELETE FROM users WHERE id=$1", [id]);
    expect(
      (await database.query("SELECT id FROM accounts WHERE user_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await database.query("SELECT id FROM sessions WHERE user_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
  });
});

describe("editable usernames", () => {
  it("assigns distinct usernames to existing and new profiles without requiring a name", async () => {
    const added = await database.query<{ username: string }>(
      "INSERT INTO users (email) VALUES ('new-cook@example.test') RETURNING username",
    );
    const usernames = [...migratedUsernames, added.rows[0].username];
    expect(new Set(usernames).size).toBe(3);
    for (const username of migratedUsernames) expect(username).toMatch(/^cook_[a-f0-9]{20}$/);
    expect(added.rows[0].username).toMatch(/^cook\d*$/);
  });

  it("derives handles from Unicode names and preserves the first rename for the user", async () => {
    const { rows } = await database.query<{ username: string; username_change_available_at: Date | null }>(`
      INSERT INTO users (email, name) VALUES
        ('name-1@example.test', '  Émilie   王! '),
        ('name-2@example.test', 'ÉMILIE 王'),
        ('name-3@example.test', '李'),
        ('name-4@example.test', repeat('A', 40)),
        ('name-5@example.test', repeat('a', 40)),
        ('name-6@example.test', '🍲')
      RETURNING username, username_change_available_at`);
    expect(rows.map(r => r.username)).toEqual([
      "émilie_王", expect.stringMatching(/^émilie_王\d+$/), "李",
      "a".repeat(32), expect.stringMatching(/^a{28}\d{4}$/), expect.stringMatching(/^cook\d*$/),
    ]);
    expect(rows.every(row => row.username_change_available_at === null)).toBe(true);
    await database.query("UPDATE users SET name='Another Name' WHERE email='name-1@example.test'");
    expect((await database.query("SELECT username FROM users WHERE email='name-1@example.test'")).rows)
      .toEqual([{ username: "émilie_王" }]);
  });

  it("preserves session and recipe ownership after a rename and enforces uniqueness", async () => {
    await database.query(
      "INSERT INTO sessions (token, user_id, expires_at, updated_at) VALUES ('rename-session', $1, now() + interval '1 day', now())",
      [ownerId],
    );
    await database.query("UPDATE users SET username = 'soup_cook' WHERE id = $1", [ownerId]);
    const owner = await database.query(
      `SELECT u.id, u.username, r.id AS recipe_id FROM users u
       JOIN sessions s ON s.user_id = u.id JOIN recipes r ON r.author_id = u.id
       WHERE s.token = 'rename-session' AND r.id = $1`, [recipeId],
    );
    expect(owner.rows).toEqual([{ id: ownerId, username: "soup_cook", recipe_id: recipeId }]);
    await expect(database.query("UPDATE users SET username = 'soup_cook' WHERE id = $1", [otherUserId]))
      .rejects.toThrow(/users_username_unique/);
  });

  it("enforces the allowed characters and length in the database", async () => {
    for (const username of ["", "a".repeat(33), "Soup", "two cooks", "🐟", "a-b", "abc\n"]) {
      await expect(database.query("UPDATE users SET username = $1 WHERE id = $2", [username, otherUserId]))
        .rejects.toThrow(/users_username_format/);
    }
  });

  it("enforces one calendar month between changes and leaves display names independent", async () => {
    const account = await database.query<{ id: string }>("INSERT INTO users (email) VALUES ('monthly@example.test') RETURNING id");
    const id = account.rows[0].id;
    const first = await database.query<{ username_change_available_at: Date; full_month: boolean }>(
      `UPDATE users SET username = 'monthly_cook' WHERE id = $1 RETURNING username_change_available_at,
       username_change_available_at = ((statement_timestamp() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC' AS full_month`,
      [id],
    );
    expect(first.rows[0].full_month).toBe(true);
    await expect(database.query("UPDATE users SET username = 'too_soon' WHERE id = $1", [id]))
      .rejects.toThrow(/once a month/);
    const same = await database.query(
      "UPDATE users SET name = '糖醋 Chef 🍲', username = 'monthly_cook' WHERE id = $1 RETURNING name, username_change_available_at",
      [id],
    );
    expect(same.rows).toEqual([{ name: "糖醋 Chef 🍲", username_change_available_at: first.rows[0].username_change_available_at }]);
    // Move the deadline into the past to exercise an eligible second rename.
    await database.query("UPDATE users SET username_change_available_at = now() - interval '1 second' WHERE id = $1", [id]);
    const next = await database.query("UPDATE users SET username = 'next_month' WHERE id = $1 RETURNING username", [id]);
    expect(next.rows).toEqual([{ username: "next_month" }]);
  });
});

describe("dietary settings and ingredient catalogue", () => {
  it("maps both soy sauce variants used by the published recipes", async () => {
    const { rows } = await database.query(
      "SELECT canonical_name FROM ingredient_allergens WHERE allergen = 'SOY' AND canonical_name IN ('light soy sauce', 'dark soy sauce') ORDER BY canonical_name",
    );
    expect(rows).toEqual([{ canonical_name: "dark soy sauce" }, { canonical_name: "light soy sauce" }]);
  });
  it("keeps preferences optional, unique to the account, and removable with the account", async () => {
    const profileId = "40000000-0000-4000-8000-000000000100";
    await database.query("INSERT INTO users (id, email) VALUES ($1, 'dietary@example.test')", [profileId]);
    const stored = () => database.query(
      "SELECT diet::text, allergens::text[] FROM dietary_settings WHERE user_id = $1", [profileId],
    );
    expect((await stored()).rows).toEqual([]);
    await database.query("INSERT INTO dietary_settings (user_id) VALUES ($1)", [profileId]);
    expect((await stored()).rows).toEqual([{ diet: "NONE", allergens: [] }]);
    await expect(database.query("INSERT INTO dietary_settings (user_id) VALUES ($1)", [profileId]))
      .rejects.toThrow(/dietary_settings_pkey/);
    await database.query("DELETE FROM users WHERE id = $1", [profileId]);
    expect((await stored()).rows).toEqual([]);
  });

  it("relates a compound ingredient to two confirmed allergens and leaves generic ingredients unmapped", async () => {
    const { rows } = await database.query(
      "SELECT allergen::text FROM ingredient_allergens WHERE canonical_name = $1 ORDER BY allergen::text",
      ["milk chocolate with peanuts"],
    );
    expect(rows).toEqual([{ allergen: "MILK" }, { allergen: "PEANUT" }]);
    await expect(database.query(
      "INSERT INTO ingredient_allergens (canonical_name, allergen) VALUES ('milk chocolate with peanuts', 'MILK')",
    )).rejects.toThrow(/ingredient_allergens_pkey/);
    await expect(database.query(
      "INSERT INTO ingredient_allergens (canonical_name, allergen) VALUES ('unmapped pantry mix', 'MILK')",
    )).rejects.toThrow(/foreign key/);
    expect((await database.query(
      "SELECT canonical_name FROM ingredient_profiles WHERE canonical_name IN ('plain flour', 'pasta', 'breadcrumbs')",
    )).rows).toEqual([]);
  });

  it("matches existing canonical names directly without requiring every recipe ingredient to have a profile", async () => {
    await database.query(
      `INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity, unit)
       VALUES ($1, 0, 'Eggs', 'eggs', 2, 'count'), ($1, 1, 'My seasoning', 'my seasoning', 1, 'g')`, [recipeId],
    );
    const { rows } = await database.query(
      `SELECT i.name, a.allergen::text FROM recipe_ingredients i
       LEFT JOIN ingredient_allergens a ON a.canonical_name = i.canonical_name
       WHERE i.recipe_id = $1 ORDER BY i.position`, [recipeId],
    );
    expect(rows).toEqual([{ name: "Eggs", allergen: "EGG" }, { name: "My seasoning", allergen: null }]);
  });
});
