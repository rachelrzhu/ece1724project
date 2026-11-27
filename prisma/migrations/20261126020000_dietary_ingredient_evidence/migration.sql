-- Install exact ingredient identities before updating their dietary evidence.
-- Serialize the backfill with recipe edits that use the catalogue trigger.
LOCK TABLE recipe_ingredients IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE dietary_ingredient_seed AS
SELECT lower(en) AS canonical_name, en, zh, fr, aliases FROM (VALUES
  ('Rye', '黑麦', 'Seigle', ARRAY['黑麥']),
  ('Rye flour', '黑麦粉', 'Farine de seigle', ARRAY['黑麥粉']),
  ('Barley flour', '大麦粉', 'Farine d’orge', ARRAY['大麥粉']),
  ('Spelt', '斯佩耳特小麦', 'Épeautre', ARRAY['spelt wheat', '斯佩爾特小麥']),
  ('Durum wheat', '硬粒小麦', 'Blé dur', ARRAY['硬粒小麥']),
  ('Seitan', '面筋', 'Seitan', ARRAY['麵筋']),
  ('Wheat gluten', '小麦面筋', 'Gluten de blé', ARRAY['小麥麵筋']),
  ('Vital wheat gluten', '谷朊粉', 'Gluten de blé en poudre', ARRAY['vital wheat gluten flour', '小麦面筋粉', '小麥麵筋粉']),
  ('Egg noodles', '鸡蛋面', 'Nouilles aux œufs', ARRAY['egg noodle', 'nouilles aux oeufs', '雞蛋麵']),
  ('Gluten-free oats', '无麸质燕麦', 'Avoine sans gluten', ARRAY['gluten free oats', '無麩質燕麥']),
  ('Lobster', '龙虾', 'Homard', ARRAY['lobsters', 'homards', '龍蝦']),
  ('Clams', '蛤蜊', 'Palourdes', ARRAY['clam', 'palourde']),
  ('Pecans', '碧根果', 'Pacanes', ARRAY['pecan', 'pecan nuts', 'pacane', 'noix de pécan']),
  ('Brazil nuts', '巴西坚果', 'Noix du Brésil', ARRAY['brazil nut', '巴西堅果']),
  ('Macadamia nuts', '夏威夷果', 'Noix de macadamia', ARRAY['macadamia nut', 'macadamias', '澳洲坚果', '澳洲堅果']),
  ('Peanut flour', '花生粉', 'Farine d’arachide', ARRAY['farine de cacahuète']),
  ('Mustard powder', '芥末粉', 'Moutarde en poudre', ARRAY['dry mustard', 'ground mustard', 'moutarde sèche']),
  ('Lactose-free milk', '无乳糖牛奶', 'Lait sans lactose', ARRAY['lactose free milk', '無乳糖牛奶']),
  ('Whey', '乳清', 'Lactosérum', ARRAY['petit-lait'])
) AS vocabulary(en, zh, fr, aliases);

INSERT INTO ingredient_profiles (canonical_name, classification)
SELECT canonical_name, 'UNKNOWN' FROM dietary_ingredient_seed ON CONFLICT DO NOTHING;

INSERT INTO ingredient_translations (canonical_name, en, zh, fr)
SELECT canonical_name, en, zh, fr FROM dietary_ingredient_seed;

CREATE TEMP TABLE dietary_ingredient_spellings AS
SELECT DISTINCT ingredient_alias_key(spelling) AS name, canonical_name
FROM dietary_ingredient_seed
CROSS JOIN LATERAL unnest(ARRAY[en, zh, fr] || aliases) AS names(spelling);

INSERT INTO ingredient_aliases (name, canonical_name)
SELECT name, canonical_name FROM dietary_ingredient_spellings;

-- Recipes written before these translations may already have a profile for
-- their original spelling. Move any evidence alongside their recipe references.
INSERT INTO ingredient_allergens (canonical_name, allergen)
SELECT DISTINCT s.canonical_name, a.allergen FROM dietary_ingredient_spellings s
JOIN ingredient_allergens a ON ingredient_alias_key(a.canonical_name) = s.name
WHERE s.canonical_name <> a.canonical_name ON CONFLICT DO NOTHING;

WITH previous AS (
  SELECT DISTINCT ON (s.canonical_name) s.canonical_name, p.classification
  FROM dietary_ingredient_spellings s
  JOIN ingredient_profiles p ON ingredient_alias_key(p.canonical_name) = s.name
  WHERE p.classification <> 'UNKNOWN'
  ORDER BY s.canonical_name, array_position(
    ARRAY['MEAT','SEAFOOD','NON_VEGETARIAN','NON_VEGAN','VEGETARIAN','VEGAN']::"IngredientDiet"[], p.classification)
)
UPDATE ingredient_profiles p SET classification = previous.classification
FROM previous WHERE p.canonical_name = previous.canonical_name;

UPDATE recipe_ingredients i SET canonical_name = s.canonical_name
FROM dietary_ingredient_spellings s
WHERE ingredient_alias_key(i.name) = s.name AND i.canonical_name <> s.canonical_name;

DELETE FROM ingredient_profiles p USING dietary_ingredient_spellings s
WHERE ingredient_alias_key(p.canonical_name) = s.name AND p.canonical_name <> s.canonical_name;

DROP TABLE dietary_ingredient_spellings, dietary_ingredient_seed;

-- Facts apply to the named ingredient. NULL leaves the corresponding fact
-- unassessed. For example, the stock can contain gluten even though its animal
-- source is known. Generic bread and pasta vary, as do unqualified oat products.
-- https://www.canada.ca/en/health-canada/services/food-nutrition/reports-publications/food-safety/gluten-pamphlet.html
WITH evidence(classification, contains_gluten, names) AS (VALUES
  ('MEAT', false, ARRAY[
    'beef', 'boneless skinless chicken breasts', 'boneless skinless chicken thighs', 'chicken',
    'chicken breast', 'chicken thighs', 'duck', 'ground beef', 'ground chicken', 'ground pork',
    'ground turkey', 'lamb', 'pork', 'pork belly', 'pork chops', 'skin-on pork belly', 'turkey']),
  ('MEAT', NULL, ARRAY['bacon', 'beef broth', 'chicken stock', 'ham']),
  ('SEAFOOD', false, ARRAY[
    'clams', 'cod', 'crab', 'crustaceans', 'fish', 'fish fillets', 'lobster', 'molluscs',
    'mussels', 'oysters', 'prawn', 'salmon', 'salmon fillets', 'sardine', 'scallops', 'shrimp',
    'squid', 'tuna', 'white fish fillets']),
  ('SEAFOOD', NULL, ARRAY['canned salmon', 'fish sauce', 'oyster sauce']),
  ('VEGETARIAN', false, ARRAY[
    'butter', 'cold milk', 'cream', 'egg', 'egg whites', 'egg yolks', 'heavy cream', 'honey',
    'lactose-free milk', 'large eggs', 'melted butter', 'milk', 'salted butter', 'unsalted butter', 'whole milk']),
  ('VEGETARIAN', NULL, ARRAY['buttermilk', 'condensed milk', 'evaporated milk', 'whipping cream']),
  ('NON_VEGAN', NULL, ARRAY[
    'cheddar', 'cheese', 'cream cheese', 'egg noodles', 'feta', 'goat cheese', 'grated parmesan', 'greek yogurt',
    'mozzarella', 'ricotta', 'sour cream', 'whey', 'yogurt']),
  ('VEGAN', true, ARRAY[
    'barley', 'barley flour', 'durum wheat', 'rye', 'rye flour', 'spelt', 'triticale',
    'vital wheat gluten', 'wheat', 'wheat flour', 'wheat gluten', 'whole wheat flour']),
  (NULL, true, ARRAY['flour tortillas', 'seitan', 'whole wheat bread']),
  ('VEGAN', NULL, ARRAY['oats', 'rolled oats']),
  ('VEGAN', false, ARRAY[
    'adzuki beans', 'almond', 'almond flour', 'apple', 'artichoke', 'asparagus', 'avocado',
    'baby spinach', 'bamboo shoots', 'banana', 'basil', 'basmati rice', 'bay leaf', 'bean sprouts',
    'beet', 'bell pepper', 'black beans', 'black pepper', 'blueberries', 'boiling water', 'bok choy',
    'brazil nuts', 'broccoli', 'broccoli florets', 'brown rice', 'buckwheat', 'cabbage',
    'canola oil', 'cardamom', 'carrot', 'cashew', 'cassia bark', 'cauliflower', 'celery',
    'cherry tomatoes', 'chili flakes', 'chili pepper', 'chives', 'chopped parsley', 'chickpeas',
    'cilantro', 'cinnamon', 'cloves', 'coconut oil', 'coriander seeds', 'corn', 'corn kernels',
    'cornstarch', 'cucumber', 'cumin seeds', 'daikon', 'dill', 'dried basil', 'dried oregano',
    'dried parsley', 'dried shiitake mushrooms', 'dried thyme', 'edamame', 'eggplant',
    'enoki mushroom', 'extra virgin olive oil', 'fennel bulb', 'fennel seeds', 'fresh basil',
    'fresh parsley', 'fresh rosemary', 'fresh thyme', 'garlic', 'garlic chives', 'garlic cloves',
    'ginger', 'gluten-free oats', 'glutinous rice', 'glutinous rice flour', 'grapes', 'green beans',
    'green bell pepper', 'green cabbage', 'green peas', 'ground cinnamon', 'ground coriander',
    'ground cumin', 'ground ginger', 'ground turmeric', 'hazelnut', 'ice cubes', 'jalapeño pepper',
    'jasmine rice', 'kale', 'kidney beans', 'kosher salt', 'leafy greens', 'leek', 'lemon',
    'lemon juice', 'lemon zest', 'lentils', 'lettuce', 'lime', 'lime juice', 'lotus root',
    'macadamia nuts', 'mango', 'millet', 'mint', 'mung beans', 'mushroom', 'mustard powder', 'mustard seeds',
    'napa cabbage', 'nutmeg', 'okra', 'olive oil', 'onion', 'orange', 'oregano', 'papaya',
    'paprika', 'parsley', 'peach', 'peanut flour', 'peanuts', 'pear', 'pecans', 'pine nuts', 'pineapple',
    'pistachio', 'potato', 'potato starch', 'pumpkin', 'purified water', 'quinoa', 'raspberries',
    'red bell pepper', 'red lentils', 'red onion', 'rice', 'rice flour', 'rosemary', 'saffron',
    'sage', 'salt', 'scallion', 'sea salt', 'sesame', 'sesame oil', 'sesame seeds', 'shallot',
    'shiitake mushroom', 'sichuan peppercorns', 'snow peas', 'soybeans', 'spinach', 'split red lentils',
    'star anise', 'strawberry', 'sunflower oil', 'sweet potato', 'table salt', 'tarragon', 'thyme',
    'tomatoes', 'tree nuts', 'turnip', 'walnut', 'warm water', 'water', 'water for steaming',
    'white onion', 'white pepper', 'white rice', 'wood ear mushroom', 'yellow onion', 'zucchini']),
  ('VEGAN', NULL, ARRAY['firm tofu', 'sesame paste', 'silken tofu', 'tahini', 'tofu'])
)
UPDATE ingredient_profiles p
SET classification = CASE
    WHEN p.classification = 'UNKNOWN'
      OR (p.classification = 'NON_VEGETARIAN' AND e.classification IN ('MEAT', 'SEAFOOD'))
      THEN coalesce(e.classification::"IngredientDiet", p.classification)
    ELSE p.classification END,
  contains_gluten = coalesce(p.contains_gluten, e.contains_gluten)
FROM evidence e WHERE p.canonical_name = ANY(e.names);

-- Record ingredients that identify the food directly. Formulations such as
-- generic sauces and highly refined oils need product-specific evidence.
-- https://inspection.canada.ca/en/food-labels/labelling/consumers/food-allergies
WITH sources(allergen, names) AS (VALUES
  ('MILK', ARRAY['cheddar', 'cheese', 'cream cheese', 'feta', 'goat cheese', 'heavy cream',
    'condensed milk', 'lactose-free milk', 'sour cream', 'whey', 'yogurt']),
  ('EGG', ARRAY['egg noodles']),
  ('PEANUT', ARRAY['peanut flour']),
  ('MUSTARD', ARRAY['mustard powder']),
  ('SOY', ARRAY['edamame', 'firm tofu', 'silken tofu', 'soy milk', 'tofu']),
  ('TREE_NUT', ARRAY['almond milk', 'brazil nuts', 'hazelnut', 'macadamia nuts', 'pecans', 'pistachio']),
  ('SESAME', ARRAY['sesame paste', 'tahini']),
  ('WHEAT_TRITICALE', ARRAY['durum wheat', 'flour tortillas', 'seitan', 'spelt', 'vital wheat gluten', 'wheat gluten', 'whole wheat bread']),
  ('FISH', ARRAY['cod', 'fish sauce', 'sardine', 'tuna']),
  ('CRUSTACEANS_MOLLUSCS', ARRAY['clams', 'crab', 'lobster', 'mussels', 'oyster sauce', 'oysters', 'scallops', 'squid'])
)
INSERT INTO ingredient_allergens (canonical_name, allergen)
SELECT unnest(names), allergen::"Allergen" FROM sources ON CONFLICT DO NOTHING;
