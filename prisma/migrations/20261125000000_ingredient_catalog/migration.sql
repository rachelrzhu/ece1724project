CREATE TABLE measurement_units (
  symbol varchar(32) PRIMARY KEY,
  menu_position integer UNIQUE
);
INSERT INTO measurement_units (symbol, menu_position) VALUES
  ('g', 1), ('kg', 2), ('mL', 3), ('L', 4), ('tsp', 5), ('tbsp', 6),
  ('cup', 7), ('oz', 8), ('lb', 9), ('count', 10);

WITH aliases(symbol, names) AS (VALUES
  ('g', ARRAY['g','gram','grams']),
  ('kg', ARRAY['kg','kilogram','kilograms']),
  ('mL', ARRAY['ml','milliliter','milliliters','millilitre','millilitres']),
  ('L', ARRAY['l','liter','liters','litre','litres']),
  ('tsp', ARRAY['tsp','teaspoon','teaspoons']),
  ('tbsp', ARRAY['tbsp','tablespoon','tablespoons']),
  ('cup', ARRAY['cup','cups']),
  ('oz', ARRAY['oz','ounce','ounces']),
  ('lb', ARRAY['lb','lbs','pound','pounds']),
  ('count', ARRAY['count','each'])
)
UPDATE recipe_ingredients i SET unit = a.symbol
FROM aliases a WHERE lower(btrim(i.unit)) = ANY(a.names) AND i.unit <> a.symbol;

-- Historical free-text units belong to their recipes and stay out of the shared menu.
INSERT INTO measurement_units (symbol)
SELECT DISTINCT unit FROM recipe_ingredients WHERE unit IS NOT NULL
ON CONFLICT DO NOTHING;
ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_unit_fkey
  FOREIGN KEY (unit) REFERENCES measurement_units(symbol) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE recipe_ingredients SET canonical_name = lower(btrim(name))
WHERE canonical_name <> lower(btrim(name));
INSERT INTO ingredient_profiles (canonical_name, classification)
SELECT DISTINCT canonical_name, 'UNKNOWN'::"IngredientDiet" FROM recipe_ingredients
ON CONFLICT DO NOTHING;

CREATE FUNCTION resolve_recipe_ingredient_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.canonical_name := lower(btrim(NEW.name));
  INSERT INTO ingredient_profiles (canonical_name, classification)
  VALUES (NEW.canonical_name, 'UNKNOWN') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recipe_ingredients_resolve_name BEFORE INSERT OR UPDATE OF name, canonical_name
ON recipe_ingredients FOR EACH ROW EXECUTE FUNCTION resolve_recipe_ingredient_name();
ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_canonical_name_fkey
  FOREIGN KEY (canonical_name) REFERENCES ingredient_profiles(canonical_name) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Prisma qualifies writes with the configured schema without changing the connection's
-- search_path. Resolve the catalogue and username lookups alongside their owning tables.
DO $paths$
DECLARE
  schema_name text := current_schema();
BEGIN
  EXECUTE format('ALTER FUNCTION %I.resolve_recipe_ingredient_name() SET search_path TO pg_catalog, %I, pg_temp',
                 schema_name, schema_name);
  EXECUTE format('ALTER FUNCTION %I.assign_signup_username() SET search_path TO pg_catalog, %I, pg_temp',
                 schema_name, schema_name);
END;
$paths$;
