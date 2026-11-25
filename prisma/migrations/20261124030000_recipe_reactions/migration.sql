CREATE TABLE "recipe_reactions" (
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    "recipe_id" UUID NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    "liked" BOOLEAN NOT NULL,
    PRIMARY KEY ("user_id", "recipe_id")
);

CREATE INDEX "recipe_reactions_recipe_id_idx" ON "recipe_reactions"("recipe_id");
