ALTER TABLE "recipes"
  ADD COLUMN "total_minutes" INTEGER GENERATED ALWAYS AS (
    NULLIF("prep_minutes" + "cook_minutes", 0)
  ) STORED;

CREATE INDEX "recipes_total_minutes_idx" ON "recipes" ("total_minutes");
