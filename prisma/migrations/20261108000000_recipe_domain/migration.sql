-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "base_servings" DECIMAL(12,4) NOT NULL,
    "prep_minutes" INTEGER NOT NULL,
    "cook_minutes" INTEGER NOT NULL,
    "difficulty" "RecipeDifficulty" NOT NULL,
    "visibility" "RecipeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "cover_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "canonical_name" VARCHAR(160) NOT NULL,
    "quantity" DECIMAL(16,6),
    "unit" VARCHAR(32),
    "note" VARCHAR(300),

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" VARCHAR(4000) NOT NULL,

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "user_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("user_id","recipe_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipes_cover_file_id_key" ON "recipes"("cover_file_id");

-- CreateIndex
CREATE INDEX "recipes_author_id_updated_at_idx" ON "recipes"("author_id", "updated_at");

-- CreateIndex
CREATE INDEX "recipes_visibility_created_at_id_idx" ON "recipes"("visibility", "created_at", "id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_canonical_name_idx" ON "recipe_ingredients"("canonical_name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipe_id_position_key" ON "recipe_ingredients"("recipe_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipe_id_position_key" ON "recipe_steps"("recipe_id", "position");

-- CreateIndex
CREATE INDEX "bookmarks_recipe_id_idx" ON "bookmarks"("recipe_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Domain checks supplement Prisma types and mirror application input limits.
ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_servings_range" CHECK ("base_servings" > 0 AND "base_servings" <= 10000),
  ADD CONSTRAINT "recipes_times_range" CHECK ("prep_minutes" BETWEEN 0 AND 10080 AND "cook_minutes" BETWEEN 0 AND 10080),
  ADD CONSTRAINT "recipes_title_required" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "recipes_description_required" CHECK (length(btrim("description")) > 0);

ALTER TABLE "recipe_ingredients"
  ADD CONSTRAINT "recipe_ingredients_position_range" CHECK ("position" BETWEEN 0 AND 99),
  ADD CONSTRAINT "recipe_ingredients_name_required" CHECK (length(btrim("name")) > 0 AND length(btrim("canonical_name")) > 0),
  ADD CONSTRAINT "recipe_ingredients_measurement" CHECK (
    ("quantity" IS NOT NULL AND "quantity" > 0 AND "quantity" <= 1000000 AND "unit" IS NOT NULL AND length(btrim("unit")) > 0)
    OR ("quantity" IS NULL AND "note" IS NOT NULL AND length(btrim("note")) > 0)
  );

ALTER TABLE "recipe_steps"
  ADD CONSTRAINT "recipe_steps_position_range" CHECK ("position" BETWEEN 0 AND 99),
  ADD CONSTRAINT "recipe_steps_instruction_required" CHECK (length(btrim("instruction")) > 0);
