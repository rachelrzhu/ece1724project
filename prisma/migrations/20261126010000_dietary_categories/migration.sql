ALTER TYPE "DietPreference" ADD VALUE 'PESCATARIAN';
ALTER TYPE "DietPreference" ADD VALUE 'GLUTEN_FREE';
ALTER TYPE "DietPreference" ADD VALUE 'DAIRY_FREE';
ALTER TYPE "DietPreference" ADD VALUE 'EGG_FREE';

ALTER TYPE "IngredientDiet" ADD VALUE 'MEAT';
ALTER TYPE "IngredientDiet" ADD VALUE 'SEAFOOD';

-- NULL leaves gluten content unassessed for existing and custom ingredients.
ALTER TABLE ingredient_profiles ADD COLUMN contains_gluten boolean;
