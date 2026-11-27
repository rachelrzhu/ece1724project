-- Keep meaningful recipe qualifiers in all three languages. Use exact aliases so
-- a custom blend or a dietary substitute keeps its own identity.
CREATE TEMP TABLE common_ingredient_seed AS
SELECT lower(en) AS canonical_name, en, zh, fr, aliases FROM (VALUES
  ('Plain breadcrumbs', '原味面包糠', 'Chapelure nature', ARRAY['plain bread crumbs', 'unseasoned breadcrumbs', 'unseasoned bread crumbs', '原味麵包糠']),
  ('Panko breadcrumbs', '日式面包糠', 'Chapelure panko', ARRAY['panko', 'panko bread crumbs', '日式麵包糠']),
  ('Onion powder', '洋葱粉', 'Poudre d’oignon', ARRAY['powdered onion', 'oignon en poudre', '洋蔥粉']),
  ('Garlic powder', '大蒜粉', 'Poudre d’ail', ARRAY['powdered garlic', 'ail en poudre', '蒜粉']),
  ('Garlic cloves', '蒜瓣', 'Gousses d’ail', ARRAY['garlic clove', 'clove of garlic', 'cloves of garlic', 'gousse d’ail']),
  ('Minced garlic', '蒜末', 'Ail haché', ARRAY['garlic, minced', '蒜蓉']),
  ('Grated Parmesan', '帕尔马奶酪碎', 'Parmesan râpé', ARRAY['grated parmesan cheese', 'parmesan cheese, grated', 'parmesan, grated', '帕爾馬乳酪碎']),
  ('White fish fillets', '白肉鱼柳', 'Filets de poisson blanc', ARRAY['white fish fillet', 'white fish filets', 'white fish filet', 'filet de poisson blanc', '白肉魚柳']),
  ('Fish fillets', '鱼柳', 'Filets de poisson', ARRAY['fish fillet', 'fish filets', 'fish filet', 'filet de poisson', '魚柳']),
  ('Salmon fillets', '三文鱼柳', 'Filets de saumon', ARRAY['salmon fillet', 'salmon filet', 'salmon filets', 'filet de saumon', '三文魚柳', '鮭魚排']),
  ('Vegetable oil', '植物油', 'Huile végétale', ARRAY['vegetable cooking oil', 'huile de table végétale']),
  ('Extra virgin olive oil', '特级初榨橄榄油', 'Huile d’olive extra vierge', ARRAY['extra-virgin olive oil', 'EVOO', 'huile d’olive vierge extra', '特級初榨橄欖油']),
  ('Salted butter', '有盐黄油', 'Beurre salé', ARRAY['有鹽奶油', '有盐奶油']),
  ('Unsalted butter', '无盐黄油', 'Beurre non salé', ARRAY['sweet unsalted butter', 'beurre doux', '無鹽奶油', '无盐奶油']),
  ('Melted butter', '融化的黄油', 'Beurre fondu', ARRAY['butter, melted', '融化的奶油']),
  ('Mozzarella', '马苏里拉奶酪', 'Mozzarella', ARRAY['mozzarella cheese', '莫札瑞拉起司', '马苏里拉芝士']),
  ('Greek yogurt', '希腊酸奶', 'Yaourt grec', ARRAY['Greek yoghurt', 'yogourt grec', '希臘優格']),
  ('Buttermilk', '酪乳', 'Babeurre', ARRAY['lait de beurre']),
  ('Evaporated milk', '淡奶', 'Lait évaporé', ARRAY['lait concentré non sucré', '蒸发奶', '蒸發奶']),
  ('Ricotta', '里科塔奶酪', 'Ricotta', ARRAY['ricotta cheese', '里考塔起司']),
  ('Whipping cream', '稀奶油', 'Crème à fouetter', ARRAY['淡奶油', '鮮奶油']),
  ('Large eggs', '大号鸡蛋', 'Gros œufs', ARRAY['large egg', 'gros œuf', '大號雞蛋']),
  ('Boneless skinless chicken breasts', '去骨去皮鸡胸肉', 'Poitrines de poulet désossées et sans peau', ARRAY['boneless skinless chicken breast', 'boneless, skinless chicken breasts', 'boneless, skinless chicken breast', 'poitrine de poulet désossée et sans peau', '去骨去皮雞胸肉']),
  ('Boneless skinless chicken thighs', '去骨去皮鸡腿肉', 'Cuisses de poulet désossées et sans peau', ARRAY['boneless skinless chicken thigh', 'boneless, skinless chicken thighs', 'boneless, skinless chicken thigh', 'cuisse de poulet désossée et sans peau', '去骨去皮雞腿肉']),
  ('Ground chicken', '鸡肉末', 'Poulet haché', ARRAY['minced chicken', '鸡肉馅', '雞絞肉']),
  ('Ground turkey', '火鸡肉末', 'Dinde hachée', ARRAY['minced turkey', '火雞絞肉']),
  ('Pork chops', '猪排', 'Côtelettes de porc', ARRAY['pork chop', 'côtelette de porc', '豬排']),
  ('Beef broth', '牛肉清汤', 'Bouillon de bœuf', ARRAY['牛肉清湯']),
  ('Diced tomatoes', '番茄丁', 'Tomates en dés', ARRAY['tomatoes, diced', 'tomate en dés', '西红柿丁']),
  ('Canned diced tomatoes', '番茄丁罐头', 'Tomates en dés en conserve', ARRAY['canned chopped tomatoes', '番茄丁罐頭']),
  ('Crushed tomatoes', '番茄碎', 'Tomates concassées', ARRAY['tomates en morceaux concassés', '碎番茄']),
  ('Tomato sauce', '番茄调味汁', 'Sauce tomate', ARRAY['番茄調味汁']),
  ('Cherry tomatoes', '樱桃番茄', 'Tomates cerises', ARRAY['cherry tomato', 'tomate cerise', '圣女果', '聖女果']),
  ('Red onion', '紫洋葱', 'Oignon rouge', ARRAY['red onions', 'oignons rouges', '紫洋蔥', '红洋葱']),
  ('Yellow onion', '黄洋葱', 'Oignon jaune', ARRAY['yellow onions', 'oignons jaunes', '黃洋蔥']),
  ('White onion', '白洋葱', 'Oignon blanc', ARRAY['white onions', 'oignons blancs', '白洋蔥']),
  ('Baby spinach', '嫩菠菜', 'Jeunes pousses d’épinards', ARRAY['baby spinach leaves', '嫩菠菜叶']),
  ('Broccoli florets', '西兰花小朵', 'Fleurons de brocoli', ARRAY['broccoli floret', 'fleurettes de brocoli', '西蘭花小朵']),
  ('Corn kernels', '玉米粒', 'Grains de maïs', ARRAY['sweet corn kernels', '甜玉米粒']),
  ('Jalapeño pepper', '墨西哥青辣椒', 'Piment jalapeño', ARRAY['jalapeño', 'jalapeños', 'jalapeño peppers', 'piments jalapeños']),
  ('Chopped parsley', '欧芹碎', 'Persil haché', ARRAY['parsley, chopped', '歐芹碎']),
  ('Fresh parsley', '新鲜欧芹', 'Persil frais', ARRAY['新鮮歐芹']),
  ('Fresh thyme', '新鲜百里香', 'Thym frais', ARRAY['新鮮百里香']),
  ('Fresh rosemary', '新鲜迷迭香', 'Romarin frais', ARRAY['新鮮迷迭香']),
  ('Dried basil', '干罗勒', 'Basilic séché', ARRAY['乾羅勒']),
  ('Dried parsley', '干欧芹', 'Persil séché', ARRAY['乾歐芹']),
  ('Ground black pepper', '研磨黑胡椒', 'Poivre noir moulu', ARRAY['black pepper, ground', '黑胡椒碎']),
  ('Kosher salt', '粗粒洁食盐', 'Sel casher', ARRAY['sel kasher', '粗粒潔食鹽']),
  ('Table salt', '精制食盐', 'Sel de table', ARRAY['精製食鹽']),
  ('Ground cinnamon', '肉桂粉', 'Cannelle moulue', ARRAY['cinnamon powder', 'cannelle en poudre']),
  ('Ground ginger', '姜粉', 'Gingembre moulu', ARRAY['ginger powder', 'gingembre en poudre', '薑粉']),
  ('Ground coriander', '芫荽籽粉', 'Coriandre moulue', ARRAY['ground coriander seeds', 'coriander powder', '香菜籽粉']),
  ('Cayenne pepper', '卡宴辣椒粉', 'Piment de Cayenne moulu', ARRAY['ground cayenne pepper', 'cayenne pepper powder', '卡宴胡椒粉']),
  ('Italian seasoning', '意式混合香草', 'Assaisonnement italien', ARRAY['Italian herb seasoning', 'mélange d’herbes à l’italienne']),
  ('Chili powder', '辣椒粉', 'Poudre de chili', ARRAY['chilli powder', 'poudre de piment chili']),
  ('Garam masala', '印度综合香料', 'Garam masala', ARRAY['garam masala powder', '印度綜合香料']),
  ('Lemon zest', '柠檬皮屑', 'Zeste de citron', ARRAY['grated lemon zest', '檸檬皮屑']),
  ('Orange juice', '橙汁', 'Jus d’orange', ARRAY['柳橙汁']),
  ('White rice', '精白米', 'Riz blanc', ARRAY['uncooked white rice']),
  ('Jasmine rice', '茉莉香米', 'Riz au jasmin', ARRAY['riz jasmin', '泰国香米', '泰國香米']),
  ('Basmati rice', '巴斯马蒂香米', 'Riz basmati', ARRAY['basmati', '印度香米']),
  ('Spaghetti', '意大利细长面', 'Spaghettis', ARRAY['spaghettis', '義大利細長麵']),
  ('Penne', '斜管意面', 'Penne', ARRAY['penne pasta', '斜管麵']),
  ('Macaroni', '通心粉', 'Macaronis', ARRAY['elbow macaroni', '通心麵']),
  ('Flour tortillas', '小麦面饼', 'Tortillas de blé', ARRAY['flour tortilla', 'tortilla de blé', '墨西哥小麥餅']),
  ('Corn tortillas', '玉米薄饼', 'Tortillas de maïs', ARRAY['corn tortilla', 'tortilla de maïs', '墨西哥玉米餅']),
  ('Bread flour', '高筋面粉', 'Farine à pain', ARRAY['strong bread flour', '高筋麵粉']),
  ('Cake flour', '低筋面粉', 'Farine à gâteau', ARRAY['低筋麵粉']),
  ('Whole wheat flour', '全麦面粉', 'Farine de blé entier', ARRAY['whole-wheat flour', 'wholemeal flour', 'farine de blé complète', '全麥麵粉']),
  ('Rice flour', '大米粉', 'Farine de riz', ARRAY['粘米粉', '在来米粉', '在來米粉']),
  ('Glutinous rice flour', '糯米粉', 'Farine de riz gluant', ARRAY['sweet rice flour']),
  ('Potato starch', '马铃薯淀粉', 'Fécule de pomme de terre', ARRAY['potato starch flour', '土豆淀粉', '馬鈴薯澱粉']),
  ('Almond flour', '杏仁粉', 'Farine d’amande', ARRAY['farine d’amandes']),
  ('Chocolate chips', '巧克力豆', 'Pépites de chocolat', ARRAY['chocolate morsels', '烘焙巧克力豆']),
  ('White wine', '白葡萄酒', 'Vin blanc', ARRAY[]::text[]),
  ('Red wine', '红葡萄酒', 'Vin rouge', ARRAY['紅葡萄酒']),
  ('White wine vinegar', '白葡萄酒醋', 'Vinaigre de vin blanc', ARRAY[]::text[]),
  ('Red wine vinegar', '红葡萄酒醋', 'Vinaigre de vin rouge', ARRAY['紅葡萄酒醋']),
  ('Hot sauce', '辣椒酱汁', 'Sauce piquante', ARRAY['辣椒醬汁']),
  ('Worcestershire sauce', '伍斯特酱', 'Sauce Worcestershire', ARRAY['Worcester sauce', '喼汁', '伍斯特醬']),
  ('Dried shiitake mushrooms', '干香菇', 'Shiitakés séchés', ARRAY['dried shiitake', 'dried shiitake mushroom', '乾香菇']),
  ('Shaoxing wine', '绍兴酒', 'Vin de Shaoxing', ARRAY['Shaoxing cooking wine', '紹興酒']),
  ('Doubanjiang with chili', '辣豆瓣酱', 'Pâte de fèves fermentées au piment', ARRAY['spicy doubanjiang', 'chili bean paste', '辣豆瓣醬']),
  ('Glutinous rice', '糯米', 'Riz gluant', ARRAY['sticky rice', 'sweet rice'])
) AS vocabulary(en, zh, fr, aliases);

-- Serialize recipe writes with alias installation and backfill, including writes
-- from earlier versions of the app. The existing trigger resolves future edits.
LOCK TABLE recipe_ingredients IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO ingredient_profiles (canonical_name, classification)
SELECT canonical_name, 'UNKNOWN' FROM common_ingredient_seed ON CONFLICT DO NOTHING;

INSERT INTO ingredient_translations (canonical_name, en, zh, fr)
SELECT canonical_name, en, zh, fr FROM common_ingredient_seed;

-- These names identify an allergen directly. Blends, breadcrumbs and oils
-- have no inferred composition, and an absent link remains unassessed.
INSERT INTO ingredient_allergens (canonical_name, allergen) VALUES
  ('white fish fillets', 'FISH'), ('fish fillets', 'FISH'), ('salmon fillets', 'FISH'),
  ('grated parmesan', 'MILK'), ('salted butter', 'MILK'), ('unsalted butter', 'MILK'),
  ('melted butter', 'MILK'), ('mozzarella', 'MILK'), ('greek yogurt', 'MILK'),
  ('buttermilk', 'MILK'), ('evaporated milk', 'MILK'), ('ricotta', 'MILK'),
  ('whipping cream', 'MILK'), ('large eggs', 'EGG'), ('almond flour', 'TREE_NUT'),
  ('whole wheat flour', 'WHEAT_TRITICALE')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE common_ingredient_spellings AS
SELECT DISTINCT ingredient_alias_key(spelling) AS name, canonical_name
FROM common_ingredient_seed
CROSS JOIN LATERAL unnest(ARRAY[en, zh, fr] || aliases) AS names(spelling)
UNION
SELECT ingredient_alias_key(spelling), canonical_name FROM (VALUES
  ('parmesan', 'Parmesan cheese'), ('parmesan', 'Parmigiano-Reggiano'),
  ('garlic', 'fresh garlic'), ('ginger', 'fresh ginger root'), ('ginger', 'fresh ginger'),
  ('cilantro', 'fresh cilantro'),
  ('plain flour', 'all-purpose white flour'), ('plain flour', 'all purpose white flour'),
  ('soy sauce', 'soya sauce'), ('chili flakes', 'crushed red pepper flakes'),
  ('powdered sugar', 'confectioners sugar'), ('powdered sugar', 'confectioner''s sugar'),
  ('sugar', 'white sugar'), ('sugar', 'white granulated sugar'),
  ('green peas', 'peas'), ('black pepper', 'black peppercorns')
) AS synonyms(canonical_name, spelling);

INSERT INTO ingredient_aliases (name, canonical_name)
SELECT name, canonical_name FROM common_ingredient_spellings;

-- Preserve positive evidence recorded under an older spelling. A translation
-- alone supplies no dietary classification or guarantee about allergens.
INSERT INTO ingredient_allergens (canonical_name, allergen)
SELECT DISTINCT s.canonical_name, a.allergen
FROM common_ingredient_spellings s
JOIN ingredient_allergens a ON ingredient_alias_key(a.canonical_name) = s.name
WHERE s.canonical_name <> a.canonical_name ON CONFLICT DO NOTHING;

WITH spellings AS (
  SELECT name, canonical_name FROM common_ingredient_spellings
  UNION
  SELECT ingredient_alias_key(canonical_name), canonical_name FROM common_ingredient_spellings
), classifications AS (
  SELECT DISTINCT ON (s.canonical_name) s.canonical_name, p.classification
  FROM spellings s
  JOIN ingredient_profiles p ON ingredient_alias_key(p.canonical_name) = s.name
  WHERE p.classification <> 'UNKNOWN'
  ORDER BY s.canonical_name,
    array_position(ARRAY['NON_VEGETARIAN','NON_VEGAN','VEGETARIAN','VEGAN']::"IngredientDiet"[], p.classification)
)
UPDATE ingredient_profiles p SET classification = c.classification
FROM classifications c WHERE p.canonical_name = c.canonical_name AND p.classification <> c.classification;

UPDATE recipe_ingredients i SET canonical_name = s.canonical_name
FROM common_ingredient_spellings s
WHERE ingredient_alias_key(i.name) = s.name AND i.canonical_name <> s.canonical_name;

DELETE FROM ingredient_profiles p USING common_ingredient_spellings s
WHERE ingredient_alias_key(p.canonical_name) = s.name AND p.canonical_name <> s.canonical_name;

DROP TABLE common_ingredient_spellings, common_ingredient_seed;
