CREATE TYPE "DietPreference" AS ENUM ('NONE', 'VEGETARIAN', 'VEGAN');

-- CFIA priority categories, including sulphites. Gluten sources are a separate label category.
-- https://inspection.canada.ca/en/food-labels/labelling/consumers/food-allergies
CREATE TYPE "Allergen" AS ENUM (
  'MILK', 'EGG', 'PEANUT', 'TREE_NUT', 'SESAME', 'SOY', 'WHEAT_TRITICALE',
  'FISH', 'CRUSTACEANS_MOLLUSCS', 'MUSTARD', 'SULPHITES'
);
CREATE TYPE "IngredientDiet" AS ENUM (
  'VEGAN', 'VEGETARIAN', 'NON_VEGETARIAN', 'NON_VEGAN', 'UNKNOWN'
);

CREATE TABLE "dietary_settings" (
  "user_id" UUID PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "diet" "DietPreference" NOT NULL DEFAULT 'NONE',
  "allergens" "Allergen"[] NOT NULL DEFAULT ARRAY[]::"Allergen"[],
  CONSTRAINT "dietary_settings_valid_allergens" CHECK (array_position("allergens", NULL) IS NULL)
);

-- Existing and copied ingredient rows can match this catalogue without changing user-authored content.
CREATE TABLE "ingredient_profiles" (
  "canonical_name" VARCHAR(160) PRIMARY KEY,
  "classification" "IngredientDiet" NOT NULL,
  CONSTRAINT "ingredient_profiles_canonical_name" CHECK (
    length("canonical_name") > 0 AND "canonical_name" = lower(btrim("canonical_name"))
  )
);
CREATE TABLE "ingredient_allergens" (
  "canonical_name" VARCHAR(160) NOT NULL REFERENCES "ingredient_profiles" ("canonical_name") ON DELETE CASCADE ON UPDATE CASCADE,
  "allergen" "Allergen" NOT NULL,
  PRIMARY KEY ("canonical_name", "allergen")
);

-- Exact named ingredients only. Flour, pasta, bread, stock blends and unspecified oils
-- vary by product. An absent link makes no claim about other allergens or cross-contact.
INSERT INTO "ingredient_profiles" ("canonical_name", "classification") VALUES
  ('fresh basil', 'VEGAN'), ('basil', 'VEGAN'), ('olive oil', 'VEGAN'), ('garlic', 'VEGAN'),
  ('lemon', 'VEGAN'), ('lemon juice', 'VEGAN'), ('chickpeas', 'VEGAN'), ('cucumber', 'VEGAN'),
  ('salt', 'VEGAN'), ('sea salt', 'VEGAN'), ('water', 'VEGAN'), ('warm water', 'VEGAN'),
  ('ice cubes', 'VEGAN'), ('banana', 'VEGAN'), ('papaya', 'VEGAN'), ('lime juice', 'VEGAN'),
  ('carrot', 'VEGAN'), ('onion', 'VEGAN'), ('ginger', 'VEGAN'), ('tomatoes', 'VEGAN'),
  ('brown rice', 'VEGAN'), ('split red lentils', 'VEGAN'), ('cumin seeds', 'VEGAN'),
  ('ground turmeric', 'VEGAN'), ('pine nuts', 'VEGAN'), ('sesame seeds', 'VEGAN'),
  ('sesame oil', 'VEGAN'), ('soybeans', 'VEGAN'), ('wheat flour', 'VEGAN'), ('peanuts', 'VEGAN'),
  ('mustard seeds', 'VEGAN'), ('dijon mustard', 'UNKNOWN'), ('soy sauce', 'UNKNOWN'),
  ('egg', 'VEGETARIAN'), ('eggs', 'VEGETARIAN'),
  ('milk', 'VEGETARIAN'), ('cold milk', 'VEGETARIAN'),
  ('butter', 'VEGETARIAN'), ('cream', 'VEGETARIAN'),
  ('plain yogurt', 'NON_VEGAN'), ('parmesan', 'NON_VEGAN'),
  ('low-moisture mozzarella', 'NON_VEGAN'), ('milk chocolate with peanuts', 'NON_VEGAN'),
  ('canned salmon', 'NON_VEGETARIAN'), ('chicken thighs', 'NON_VEGETARIAN'), ('chicken stock', 'NON_VEGETARIAN'),
  ('shrimp', 'NON_VEGETARIAN');

INSERT INTO "ingredient_allergens" ("canonical_name", "allergen") VALUES
  ('egg', 'EGG'), ('eggs', 'EGG'), ('milk', 'MILK'), ('cold milk', 'MILK'),
  ('butter', 'MILK'), ('cream', 'MILK'), ('plain yogurt', 'MILK'), ('parmesan', 'MILK'),
  ('low-moisture mozzarella', 'MILK'), ('milk chocolate with peanuts', 'MILK'),
  ('milk chocolate with peanuts', 'PEANUT'), ('peanuts', 'PEANUT'), ('pine nuts', 'TREE_NUT'),
  ('sesame seeds', 'SESAME'), ('sesame oil', 'SESAME'), ('soybeans', 'SOY'), ('soy sauce', 'SOY'),
  ('wheat flour', 'WHEAT_TRITICALE'), ('mustard seeds', 'MUSTARD'), ('dijon mustard', 'MUSTARD'),
  ('canned salmon', 'FISH'), ('shrimp', 'CRUSTACEANS_MOLLUSCS');
