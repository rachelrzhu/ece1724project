-- Recognize exact ingredient names used by cooks, including the soy sauces in published recipes.
WITH matches (canonical_name, allergen) AS (VALUES
  ('whole milk', 'MILK'), ('egg whites', 'EGG'), ('egg yolks', 'EGG'),
  ('peanut', 'PEANUT'), ('peanut butter', 'PEANUT'),
  ('tree nuts', 'TREE_NUT'), ('almond', 'TREE_NUT'), ('almonds', 'TREE_NUT'),
  ('walnut', 'TREE_NUT'), ('walnuts', 'TREE_NUT'), ('cashew', 'TREE_NUT'), ('cashews', 'TREE_NUT'),
  ('sesame', 'SESAME'), ('soy', 'SOY'), ('light soy sauce', 'SOY'), ('dark soy sauce', 'SOY'),
  ('wheat', 'WHEAT_TRITICALE'), ('triticale', 'WHEAT_TRITICALE'),
  ('fish', 'FISH'), ('salmon', 'FISH'),
  ('crustaceans', 'CRUSTACEANS_MOLLUSCS'), ('molluscs', 'CRUSTACEANS_MOLLUSCS'),
  ('prawn', 'CRUSTACEANS_MOLLUSCS'), ('prawns', 'CRUSTACEANS_MOLLUSCS'),
  ('mustard', 'MUSTARD'), ('sulphites', 'SULPHITES'), ('sulfites', 'SULPHITES')
), profiles AS (
  INSERT INTO ingredient_profiles (canonical_name, classification)
  SELECT canonical_name, 'UNKNOWN' FROM matches
  ON CONFLICT (canonical_name) DO NOTHING
)
INSERT INTO ingredient_allergens (canonical_name, allergen)
SELECT canonical_name, allergen::"Allergen" FROM matches
ON CONFLICT DO NOTHING;
