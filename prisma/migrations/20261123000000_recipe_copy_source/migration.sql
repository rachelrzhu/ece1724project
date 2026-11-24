-- An editable copy retains its source UUID after the original recipe is deleted.
ALTER TABLE "recipes" ADD COLUMN "source_recipe_id" UUID;
