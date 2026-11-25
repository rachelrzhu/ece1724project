-- The index uses one spelling for French accents, ligatures, apostrophes and whitespace.
-- Explicit folding also works on the loopback database's C locale.
CREATE FUNCTION ingredient_alias_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog AS $$
  WITH decomposed AS (
    SELECT regexp_replace(normalize(value, NFKD), U&'[\0300-\036F]', '', 'g') AS value
  ), latin AS (
    SELECT lower(translate(value, 'ŒÆ', 'œæ') COLLATE "C") AS value FROM decomposed
  ), expanded AS (
    SELECT replace(replace(value, 'œ', 'oe'), 'æ', 'ae') AS value FROM latin
  )
  SELECT btrim(regexp_replace(regexp_replace(value, '[’‘ʼ]', '''', 'g'), '[[:space:]]+', ' ', 'g'))
  FROM expanded
$$;

CREATE TABLE ingredient_translations (
  canonical_name varchar(160) PRIMARY KEY REFERENCES ingredient_profiles(canonical_name) ON DELETE CASCADE ON UPDATE CASCADE,
  en varchar(160) NOT NULL,
  zh varchar(160) NOT NULL,
  fr varchar(160) NOT NULL
);
CREATE TABLE ingredient_aliases (
  name varchar(160) PRIMARY KEY CHECK (name <> '' AND name = ingredient_alias_key(name)),
  canonical_name varchar(160) NOT NULL REFERENCES ingredient_profiles(canonical_name) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX ingredient_aliases_canonical_name_idx ON ingredient_aliases(canonical_name);

CREATE TEMP TABLE multilingual_ingredient_seed AS
SELECT * FROM (VALUES
  ('egg', 'Egg', '鸡蛋', 'Œuf', ARRAY['eggs', 'œufs', '雞蛋', '蛋', 'hen''s egg', 'chicken egg', '鸡子', '鲜鸡蛋', '鮮雞蛋']::text[]),
  ('egg whites', 'Egg whites', '蛋清', 'Blanc d’œuf', ARRAY['egg white', 'blanc d''oeuf', 'blancs d’œufs', 'blancs d’œuf', '鸡蛋清', '雞蛋清', '蛋白']::text[]),
  ('egg yolks', 'Egg yolks', '蛋黄', 'Jaune d’œuf', ARRAY['egg yolk', 'jaunes d’œufs', 'jaunes d’œuf', '蛋黃', '鸡蛋黄', '雞蛋黃']::text[]),
  ('eggplant', 'Eggplant', '茄子', 'Aubergine', ARRAY['eggplants', 'aubergines']::text[]),
  ('milk', 'Milk', '牛奶', 'Lait', ARRAY['奶', 'lait de vache']::text[]),
  ('whole milk', 'Whole milk', '全脂牛奶', 'Lait entier', ARRAY['全脂奶']::text[]),
  ('cold milk', 'Cold milk', '冷牛奶', 'Lait froid', ARRAY['冰牛奶']::text[]),
  ('butter', 'Butter', '黄油', 'Beurre', ARRAY['黃油', '牛油']::text[]),
  ('cream', 'Cream', '奶油', 'Crème', ARRAY['乳脂']::text[]),
  ('plain yogurt', 'Plain yogurt', '原味酸奶', 'Yaourt nature', ARRAY['plain yoghurt', 'yogourt nature', '原味酸奶酪', '原味優格']::text[]),
  ('parmesan', 'Parmesan', '帕尔马干酪', 'Parmesan', ARRAY['帕馬森起司', '帕尔马奶酪', '帕爾馬乾酪', 'parmigiano reggiano']::text[]),
  ('low-moisture mozzarella', 'Low-moisture mozzarella', '低水分马苏里拉奶酪', 'Mozzarella à faible teneur en humidité', ARRAY['低水分莫札瑞拉起司']::text[]),
  ('milk chocolate with peanuts', 'Milk chocolate with peanuts', '花生牛奶巧克力', 'Chocolat au lait aux arachides', ARRAY['chocolat au lait aux cacahuètes']::text[]),
  ('pasta', 'Pasta', '意大利面', 'Pâtes', ARRAY['意粉', '義大利麵', '意面', '意大利麵', 'pâtes alimentaires']::text[]),
  ('fresh basil', 'Fresh basil', '新鲜罗勒', 'Basilic frais', ARRAY['新鮮羅勒']::text[]),
  ('basil', 'Basil', '罗勒', 'Basilic', ARRAY['羅勒']::text[]),
  ('olive oil', 'Olive oil', '橄榄油', 'Huile d’olive', ARRAY['橄欖油']::text[]),
  ('lemon', 'Lemon', '柠檬', 'Citron', ARRAY['lemons', 'citrons', '檸檬']::text[]),
  ('garlic', 'Garlic', '大蒜', 'Ail', ARRAY['蒜', '蒜头', '蒜頭']::text[]),
  ('sea salt', 'Sea salt', '海盐', 'Sel de mer', ARRAY['sel marin', '海鹽']::text[]),
  ('chickpeas', 'Chickpeas', '鹰嘴豆', 'Pois chiches', ARRAY['chickpea', 'pois chiche', '鷹嘴豆']::text[]),
  ('mixed greens', 'Mixed greens', '混合沙拉菜', 'Mesclun', ARRAY['mixed salad greens', '混合生菜']::text[]),
  ('cucumber', 'Cucumber', '黄瓜', 'Concombre', ARRAY['cucumbers', 'concombres', '黃瓜', '青瓜']::text[]),
  ('lemon juice', 'Lemon juice', '柠檬汁', 'Jus de citron', ARRAY['檸檬汁']::text[]),
  ('salt', 'Salt', '盐', 'Sel', ARRAY['鹽', '食盐', '食鹽']::text[]),
  ('plain flour', 'Plain flour', '中筋面粉', 'Farine tout usage', ARRAY['all-purpose flour', 'all purpose flour', '中筋麵粉', 'farine ordinaire']::text[]),
  ('flour', 'Flour', '面粉', 'Farine', ARRAY['麵粉']::text[]),
  ('sugar', 'Sugar', '糖', 'Sucre', ARRAY['白糖', '白砂糖', 'granulated sugar', 'sucre blanc']::text[]),
  ('baking powder', 'Baking powder', '泡打粉', 'Levure chimique', ARRAY['poudre à pâte']::text[]),
  ('tomatoes', 'Tomatoes', '番茄', 'Tomates', ARRAY['tomato', 'tomate', '西红柿', '西紅柿', '蕃茄']::text[]),
  ('onion', 'Onion', '洋葱', 'Oignon', ARRAY['onions', 'oignons', '洋蔥']::text[]),
  ('vegetable stock', 'Vegetable stock', '蔬菜高汤', 'Bouillon de légumes', ARRAY['vegetable broth', '蔬菜高湯']::text[]),
  ('sourdough bread', 'Sourdough bread', '酸种面包', 'Pain au levain', ARRAY['酸種麵包', '天然酵母面包']::text[]),
  ('avocado', 'Avocado', '牛油果', 'Avocat', ARRAY['avocados', 'avocats', '鳄梨', '鱷梨', '酪梨']::text[]),
  ('chili flakes', 'Chili flakes', '辣椒碎', 'Flocons de piment', ARRAY['chilli flakes', 'red pepper flakes', '辣椒片']::text[]),
  ('brown rice', 'Brown rice', '糙米', 'Riz brun', ARRAY['riz complet']::text[]),
  ('broccoli', 'Broccoli', '西兰花', 'Brocoli', ARRAY['西蘭花', '绿花椰菜', '綠花椰菜', '青花菜', 'brocolis']::text[]),
  ('carrot', 'Carrot', '胡萝卜', 'Carotte', ARRAY['carrots', 'carottes', '胡蘿蔔', '红萝卜', '紅蘿蔔']::text[]),
  ('soy sauce', 'Soy sauce', '酱油', 'Sauce soja', ARRAY['醬油', '豉油', 'sauce soya']::text[]),
  ('sesame oil', 'Sesame oil', '芝麻油', 'Huile de sésame', ARRAY['香油', '麻油']::text[]),
  ('ginger', 'Ginger', '生姜', 'Gingembre', ARRAY['姜', '薑', '生薑']::text[]),
  ('pine nuts', 'Pine nuts', '松子', 'Pignons de pin', ARRAY['pine nut', 'pignon de pin']::text[]),
  ('split red lentils', 'Split red lentils', '去皮红扁豆', 'Lentilles corail décortiquées', ARRAY['去皮紅扁豆', 'split red lentil']::text[]),
  ('water', 'Water', '水', 'Eau', ARRAY['清水']::text[]),
  ('ground turmeric', 'Ground turmeric', '姜黄粉', 'Curcuma moulu', ARRAY['薑黃粉', 'turmeric powder']::text[]),
  ('neutral oil', 'Neutral oil', '中性油', 'Huile neutre', ARRAY['中性食用油', 'neutral cooking oil']::text[]),
  ('cumin seeds', 'Cumin seeds', '孜然籽', 'Graines de cumin', ARRAY['cumin seed', 'graine de cumin']::text[]),
  ('papaya', 'Papaya', '木瓜', 'Papaye', ARRAY['papayas', 'papayes']::text[]),
  ('banana', 'Banana', '香蕉', 'Banane', ARRAY['bananas', 'bananes']::text[]),
  ('lime juice', 'Lime juice', '青柠汁', 'Jus de lime', ARRAY['jus de citron vert', '青檸汁']::text[]),
  ('ice cubes', 'Ice cubes', '冰块', 'Glaçons', ARRAY['ice cube', 'glaçon', '冰塊']::text[]),
  ('canned salmon', 'Canned salmon', '三文鱼罐头', 'Saumon en conserve', ARRAY['罐头三文鱼', '鮭魚罐頭', '三文魚罐頭', '罐装三文鱼']::text[]),
  ('breadcrumbs', 'Breadcrumbs', '面包糠', 'Chapelure', ARRAY['bread crumbs', '麵包糠', '麵包粉']::text[]),
  ('scallion', 'Scallion', '葱', 'Oignon vert', ARRAY['scallions', 'green onion', 'green onions', 'spring onion', 'spring onions', 'oignons verts', 'cébette', 'cébettes', '青葱', '青蔥', '蔥', '小葱', '小蔥', '香葱']::text[]),
  ('dijon mustard', 'Dijon mustard', '第戎芥末酱', 'Moutarde de Dijon', ARRAY['第戎芥末醬', '第戎芥末']::text[]),
  ('green cabbage', 'Green cabbage', '绿甘蓝', 'Chou vert', ARRAY['綠甘藍', '绿卷心菜']::text[]),
  ('apple cider vinegar', 'Apple cider vinegar', '苹果醋', 'Vinaigre de cidre', ARRAY['蘋果醋']::text[]),
  ('dried oregano', 'Dried oregano', '干牛至', 'Origan séché', ARRAY['乾牛至']::text[]),
  ('masa harina', 'Masa harina', '碱化玉米粉', 'Farine de maïs nixtamalisé', ARRAY['鹼化玉米粉']::text[]),
  ('warm water', 'Warm water', '温水', 'Eau tiède', ARRAY['溫水']::text[]),
  ('green bell pepper', 'Green bell pepper', '青甜椒', 'Poivron vert', ARRAY['green bell peppers', 'poivrons verts', '绿甜椒', '青椒', '綠甜椒']::text[]),
  ('celery', 'Celery', '芹菜', 'Céleri', ARRAY['西芹']::text[]),
  ('smoked paprika', 'Smoked paprika', '烟熏红椒粉', 'Paprika fumé', ARRAY['煙燻紅椒粉']::text[]),
  ('dried thyme', 'Dried thyme', '干百里香', 'Thym séché', ARRAY['乾百里香']::text[]),
  ('chicken stock', 'Chicken stock', '鸡高汤', 'Bouillon de poulet', ARRAY['chicken broth', 'bouillon de volaille', '鸡汤', '雞湯', '雞高湯']::text[]),
  ('chicken thighs', 'Chicken thighs', '鸡腿肉', 'Cuisses de poulet', ARRAY['chicken thigh', 'cuisse de poulet', '雞腿肉']::text[]),
  ('okra', 'Okra', '秋葵', 'Gombo', ARRAY['gombos']::text[]),
  ('cooked rice', 'Cooked rice', '米饭', 'Riz cuit', ARRAY['米飯']::text[]),
  ('fresh noodles', 'Fresh noodles', '鲜面条', 'Nouilles fraîches', ARRAY['鲜面', '鮮麵條', '鮮麵']::text[]),
  ('ground dried chiles', 'Ground dried chiles', '干辣椒粉', 'Piment séché moulu', ARRAY['乾辣椒粉', 'ground dried chilies']::text[]),
  ('cooking oil', 'Cooking oil', '食用油', 'Huile de cuisson', ARRAY[]::text[]),
  ('light soy sauce', 'Light soy sauce', '生抽', 'Sauce soja claire', ARRAY['生抽酱油', '醬油生抽', 'sauce soya claire']::text[]),
  ('chinese aromatic vinegar', 'Chinese aromatic vinegar', '香醋', 'Vinaigre aromatique chinois', ARRAY['中式香醋', 'Chinese black aromatic vinegar']::text[]),
  ('leafy greens', 'Leafy greens', '绿叶菜', 'Légumes-feuilles', ARRAY['綠葉菜', '绿叶蔬菜', '綠葉蔬菜', 'légumes à feuilles']::text[]),
  ('bean sprouts', 'Bean sprouts', '豆芽', 'Germes de haricots', ARRAY['bean sprout', 'pousses de haricots']::text[]),
  ('sesame seeds', 'Sesame seeds', '芝麻籽', 'Graines de sésame', ARRAY['sesame seed', 'graine de sésame']::text[]),
  ('sichuan peppercorns', 'Sichuan peppercorns', '花椒', 'Poivre du Sichuan', ARRAY['szechuan peppercorns', 'sichuan pepper', 'sichuan peppercorn', '花椒粒']::text[]),
  ('star anise', 'Star anise', '八角', 'Badiane', ARRAY['anis étoilé', '大料']::text[]),
  ('cassia bark', 'Cassia bark', '桂皮', 'Écorce de cannelle de Chine', ARRAY['casse', '肉桂皮']::text[]),
  ('bay leaf', 'Bay leaf', '香叶', 'Feuille de laurier', ARRAY['bay leaves', 'feuilles de laurier', '香葉', '月桂叶', '月桂葉']::text[]),
  ('skin-on pork belly', 'Skin-on pork belly', '带皮五花肉', 'Poitrine de porc avec couenne', ARRAY['帶皮五花肉']::text[]),
  ('rock sugar', 'Rock sugar', '冰糖', 'Sucre candi', ARRAY[]::text[]),
  ('chinese cooking wine', 'Chinese cooking wine', '料酒', 'Vin de cuisine chinois', ARRAY['中式料酒']::text[]),
  ('dark soy sauce', 'Dark soy sauce', '老抽', 'Sauce soja foncée', ARRAY['老抽酱油', 'sauce soya foncée']::text[]),
  ('small dried hot chiles', 'Small dried hot chiles', '小干辣椒', 'Petits piments forts séchés', ARRAY['小乾辣椒', 'small dried hot chilies']::text[]),
  ('boiling water', 'Boiling water', '沸水', 'Eau bouillante', ARRAY['开水', '開水']::text[]),
  ('white vinegar', 'White vinegar', '白醋', 'Vinaigre blanc', ARRAY[]::text[]),
  ('purified water', 'Purified water', '纯净水', 'Eau purifiée', ARRAY['純淨水']::text[]),
  ('water for steaming', 'Water for steaming', '蒸制用水', 'Eau pour la cuisson à la vapeur', ARRAY['蒸製用水']::text[]),
  ('peanuts', 'Peanuts', '花生', 'Arachides', ARRAY['peanut', 'arachide', 'cacahuète', 'cacahuètes']::text[]),
  ('peanut butter', 'Peanut butter', '花生酱', 'Beurre d’arachide', ARRAY['beurre de cacahuètes', '花生醬', 'beurre d''arachides']::text[]),
  ('tree nuts', 'Tree nuts', '树坚果', 'Fruits à coque', ARRAY['tree nut', 'fruit à coque', 'noix à coque', '樹堅果']::text[]),
  ('almond', 'Almond', '杏仁', 'Amande', ARRAY['almonds', 'amandes', '扁桃仁']::text[]),
  ('walnut', 'Walnut', '核桃', 'Noix', ARRAY['walnuts', '胡桃', 'noix de Grenoble']::text[]),
  ('cashew', 'Cashew', '腰果', 'Noix de cajou', ARRAY['cashews']::text[]),
  ('sesame', 'Sesame', '芝麻', 'Sésame', ARRAY[]::text[]),
  ('soybeans', 'Soybeans', '黄豆', 'Graines de soja', ARRAY['soybean', 'soya beans', 'soy beans', '大豆', '黃豆', 'fèves de soja']::text[]),
  ('soy', 'Soy', '大豆制品', 'Soja', ARRAY['soya', '大豆製品']::text[]),
  ('wheat', 'Wheat', '小麦', 'Blé', ARRAY['小麥']::text[]),
  ('wheat flour', 'Wheat flour', '小麦粉', 'Farine de blé', ARRAY['小麦面粉', '小麥粉', '小麥麵粉']::text[]),
  ('triticale', 'Triticale', '小黑麦', 'Triticale', ARRAY['小黑麥']::text[]),
  ('fish', 'Fish', '鱼', 'Poisson', ARRAY['魚', '鱼肉', '魚肉', 'poissons']::text[]),
  ('salmon', 'Salmon', '三文鱼', 'Saumon', ARRAY['鮭魚', '鲑鱼', '三文魚']::text[]),
  ('crustaceans', 'Crustaceans', '甲壳类', 'Crustacés', ARRAY['crustacean', 'crustacé', '甲殼類']::text[]),
  ('molluscs', 'Molluscs', '软体动物', 'Mollusques', ARRAY['mollusks', 'mollusc', 'mollusk', 'mollusque', '軟體動物']::text[]),
  ('prawn', 'Prawn', '对虾', 'Gambas', ARRAY['prawns', '大虾', '對蝦', '大蝦', 'gamba']::text[]),
  ('shrimp', 'Shrimp', '虾', 'Crevette', ARRAY['shrimps', 'crevettes', '蝦', '虾仁', '蝦仁']::text[]),
  ('mustard', 'Mustard', '芥末', 'Moutarde', ARRAY['芥末酱', '芥末醬']::text[]),
  ('mustard seeds', 'Mustard seeds', '芥菜籽', 'Graines de moutarde', ARRAY['mustard seed', 'graine de moutarde', '芥末籽']::text[]),
  ('sulphites', 'Sulphites', '亚硫酸盐', 'Sulfites', ARRAY['sulfites', 'sulphite', 'sulfite', '亞硫酸鹽']::text[]),
  ('rice', 'Rice', '大米', 'Riz', ARRAY['米', '白米', 'uncooked rice']::text[]),
  ('chicken', 'Chicken', '鸡肉', 'Poulet', ARRAY['雞肉']::text[]),
  ('beef', 'Beef', '牛肉', 'Bœuf', ARRAY[]::text[]),
  ('pork', 'Pork', '猪肉', 'Porc', ARRAY['豬肉']::text[]),
  ('pork belly', 'Pork belly', '五花肉', 'Poitrine de porc', ARRAY[]::text[]),
  ('lamb', 'Lamb', '羊羔肉', 'Agneau', ARRAY['羔羊肉']::text[]),
  ('tofu', 'Tofu', '豆腐', 'Tofu', ARRAY['bean curd']::text[]),
  ('potato', 'Potato', '土豆', 'Pomme de terre', ARRAY['potatoes', 'pommes de terre', '马铃薯', '馬鈴薯']::text[]),
  ('sweet potato', 'Sweet potato', '红薯', 'Patate douce', ARRAY['sweet potatoes', 'patates douces', '紅薯', '地瓜', '甘薯']::text[]),
  ('spinach', 'Spinach', '菠菜', 'Épinards', ARRAY['épinard']::text[]),
  ('cabbage', 'Cabbage', '卷心菜', 'Chou', ARRAY['cabbages', 'choux', '圆白菜', '圓白菜', '高丽菜', '高麗菜']::text[]),
  ('lettuce', 'Lettuce', '生菜', 'Laitue', ARRAY['laitues']::text[]),
  ('mushroom', 'Mushroom', '蘑菇', 'Champignon', ARRAY['mushrooms', 'champignons']::text[]),
  ('bok choy', 'Bok choy', '小白菜', 'Pak-choï', ARRAY['bok choi', 'pak choi', '上海青']::text[]),
  ('bell pepper', 'Bell pepper', '甜椒', 'Poivron', ARRAY['bell peppers', 'poivrons', '彩椒']::text[]),
  ('black pepper', 'Black pepper', '黑胡椒', 'Poivre noir', ARRAY['黑胡椒粉']::text[]),
  ('white pepper', 'White pepper', '白胡椒', 'Poivre blanc', ARRAY['白胡椒粉']::text[]),
  ('chili pepper', 'Chili pepper', '辣椒', 'Piment', ARRAY['chili', 'chilli', 'chile', 'chiles', 'chillies', 'chilies', 'chili peppers', 'piments']::text[]),
  ('vinegar', 'Vinegar', '醋', 'Vinaigre', ARRAY['食醋']::text[]),
  ('rice vinegar', 'Rice vinegar', '米醋', 'Vinaigre de riz', ARRAY[]::text[]),
  ('honey', 'Honey', '蜂蜜', 'Miel', ARRAY[]::text[]),
  ('cheese', 'Cheese', '奶酪', 'Fromage', ARRAY['乳酪', '起司', '乾酪', '芝士']::text[]),
  ('bread', 'Bread', '面包', 'Pain', ARRAY['麵包']::text[]),
  ('noodles', 'Noodles', '面条', 'Nouilles', ARRAY['noodle', 'nouille', '麵條']::text[]),
  ('cilantro', 'Cilantro', '香菜', 'Coriandre fraîche', ARRAY['fresh coriander', 'Chinese parsley', '芫荽']::text[]),
  ('parsley', 'Parsley', '欧芹', 'Persil', ARRAY['歐芹', '洋香菜']::text[]),
  ('cinnamon', 'Cinnamon', '肉桂', 'Cannelle', ARRAY[]::text[]),
  ('apple', 'Apple', '苹果', 'Pomme', ARRAY['apples', 'pommes', '蘋果']::text[]),
  ('orange', 'Orange', '橙子', 'Orange', ARRAY['oranges', '甜橙']::text[]),
  ('strawberry', 'Strawberry', '草莓', 'Fraise', ARRAY['strawberries', 'fraises']::text[]),
  ('corn', 'Corn', '玉米', 'Maïs', ARRAY['maize']::text[]),
  ('cornstarch', 'Cornstarch', '玉米淀粉', 'Fécule de maïs', ARRAY['corn starch', '玉米澱粉', 'amidon de maïs']::text[]),
  ('oyster sauce', 'Oyster sauce', '蚝油', 'Sauce aux huîtres', ARRAY['蠔油']::text[]),
  ('coconut milk', 'Coconut milk', '椰奶', 'Lait de coco', ARRAY['椰浆', '椰漿']::text[]),
  ('yogurt', 'Yogurt', '酸奶', 'Yaourt', ARRAY['yoghurt', 'yogourt', '優格']::text[]),
  ('maple syrup', 'Maple syrup', '枫糖浆', 'Sirop d’érable', ARRAY['楓糖漿']::text[]),
  ('oat milk', 'Oat milk', '燕麦奶', 'Lait d’avoine', ARRAY['oat drink', 'boisson à l’avoine', '燕麥奶']::text[]),
  ('soy milk', 'Soy milk', '豆奶', 'Lait de soja', ARRAY['soya milk', 'soy drink', 'boisson au soja', 'lait de soya', '豆浆', '豆漿']::text[]),
  ('almond milk', 'Almond milk', '杏仁奶', 'Lait d’amande', ARRAY['almond drink', 'boisson à l’amande']::text[]),
  ('coconut oil', 'Coconut oil', '椰子油', 'Huile de coco', ARRAY['椰油']::text[]),
  ('canola oil', 'Canola oil', '芥花油', 'Huile de canola', ARRAY['低芥酸菜籽油']::text[]),
  ('sunflower oil', 'Sunflower oil', '葵花籽油', 'Huile de tournesol', ARRAY['葵花油']::text[]),
  ('peanut oil', 'Peanut oil', '花生油', 'Huile d’arachide', ARRAY[]::text[]),
  ('sour cream', 'Sour cream', '酸奶油', 'Crème sure', ARRAY['soured cream', 'crème aigre']::text[]),
  ('cream cheese', 'Cream cheese', '奶油奶酪', 'Fromage à la crème', ARRAY['奶油乳酪', '忌廉芝士']::text[]),
  ('cheddar', 'Cheddar', '切达奶酪', 'Cheddar', ARRAY['cheddar cheese', '切達起司', '車打芝士', '切達乾酪']::text[]),
  ('feta', 'Feta', '菲达奶酪', 'Feta', ARRAY['feta cheese', 'féta', '菲達乳酪']::text[]),
  ('goat cheese', 'Goat cheese', '山羊奶酪', 'Fromage de chèvre', ARRAY['goat’s cheese', '山羊乳酪']::text[]),
  ('heavy cream', 'Heavy cream', '重奶油', 'Crème entière liquide', ARRAY['heavy whipping cream', '重鲜奶油', '重鮮奶油']::text[]),
  ('condensed milk', 'Condensed milk', '炼乳', 'Lait concentré sucré', ARRAY['sweetened condensed milk', 'lait condensé sucré', '煉乳', '炼奶', '煉奶']::text[]),
  ('black beans', 'Black beans', '黑菜豆', 'Haricots noirs', ARRAY['black bean', 'black turtle beans', 'turtle beans', 'haricot noir', '黑芸豆']::text[]),
  ('kidney beans', 'Kidney beans', '芸豆', 'Haricots rouges', ARRAY['kidney bean', 'red kidney beans', 'haricot rouge', '红腰豆', '紅腰豆']::text[]),
  ('green beans', 'Green beans', '四季豆', 'Haricots verts', ARRAY['green bean', 'string beans', 'string bean', 'haricot vert', '青刀豆']::text[]),
  ('mung beans', 'Mung beans', '绿豆', 'Haricots mungo', ARRAY['mung bean', 'haricot mungo', '綠豆']::text[]),
  ('adzuki beans', 'Adzuki beans', '小豆', 'Haricots azuki', ARRAY['adzuki bean', 'azuki beans', 'haricots adzuki', 'haricot azuki', '红小豆', '紅小豆']::text[]),
  ('lentils', 'Lentils', '扁豆粒', 'Lentilles', ARRAY['lentil', 'lentille', '小扁豆', '兵豆']::text[]),
  ('green peas', 'Green peas', '青豌豆', 'Petits pois', ARRAY['green pea', 'petit pois', '豌豆', '青豆仁']::text[]),
  ('snow peas', 'Snow peas', '荷兰豆', 'Pois mange-tout', ARRAY['snow pea', 'pois mangetout', '荷蘭豆']::text[]),
  ('edamame', 'Edamame', '毛豆', 'Edamame', ARRAY['edamames', '枝豆']::text[]),
  ('firm tofu', 'Firm tofu', '老豆腐', 'Tofu ferme', ARRAY['硬豆腐', '北豆腐']::text[]),
  ('silken tofu', 'Silken tofu', '内酯豆腐', 'Tofu soyeux', ARRAY['silk tofu', '內酯豆腐', '绢豆腐', '絹豆腐']::text[]),
  ('tempeh', 'Tempeh', '天贝', 'Tempeh', ARRAY['天貝', '丹贝', '丹貝']::text[]),
  ('red lentils', 'Red lentils', '红扁豆', 'Lentilles corail', ARRAY['red lentil', 'lentille corail', '紅扁豆']::text[]),
  ('oats', 'Oats', '燕麦', 'Avoine', ARRAY['燕麥']::text[]),
  ('rolled oats', 'Rolled oats', '燕麦片', 'Flocons d’avoine', ARRAY['old-fashioned oats', 'flocon d’avoine', '燕麥片']::text[]),
  ('quinoa', 'Quinoa', '藜麦', 'Quinoa', ARRAY['藜麥']::text[]),
  ('barley', 'Barley', '大麦', 'Orge', ARRAY['大麥']::text[]),
  ('buckwheat', 'Buckwheat', '荞麦', 'Sarrasin', ARRAY['blé noir', '蕎麥']::text[]),
  ('millet', 'Millet', '小米', 'Millet', ARRAY['小米粒']::text[]),
  ('couscous', 'Couscous', '古斯米', 'Couscous', ARRAY['semoule de couscous', '库斯库斯', '庫斯庫斯']::text[]),
  ('rice noodles', 'Rice noodles', '米粉', 'Nouilles de riz', ARRAY['rice noodle', 'nouille de riz', '米线', '米線']::text[]),
  ('udon noodles', 'Udon noodles', '乌冬面', 'Nouilles udon', ARRAY['udon', '乌龙面', '烏龍麵', '烏冬麵']::text[]),
  ('glass noodles', 'Glass noodles', '粉丝', 'Vermicelles de fécule', ARRAY['cellophane noodles', 'bean thread noodles', '粉絲']::text[]),
  ('rice paper', 'Rice paper', '米纸', 'Feuilles de riz', ARRAY['rice paper wrappers', 'feuille de riz', '米紙', '越南春卷皮']::text[]),
  ('baguette', 'Baguette', '法棍', 'Baguette', ARRAY['baguettes', 'baguette de pain', '法式长棍面包', '法式長棍麵包']::text[]),
  ('whole wheat bread', 'Whole wheat bread', '全麦面包', 'Pain de blé entier', ARRAY['wholemeal bread', 'pain complet', '全麥麵包']::text[]),
  ('puff pastry', 'Puff pastry', '千层酥皮', 'Pâte feuilletée', ARRAY['千層酥皮', '起酥皮']::text[]),
  ('baking soda', 'Baking soda', '小苏打', 'Bicarbonate de soude', ARRAY['bicarbonate of soda', 'bicarbonate de sodium', '小蘇打']::text[]),
  ('yeast', 'Yeast', '酵母', 'Levure de boulanger', ARRAY['baker’s yeast', 'levure boulangère', '酵母菌']::text[]),
  ('brown sugar', 'Brown sugar', '红糖', 'Sucre brun', ARRAY['cassonade', '紅糖', '黄糖', '黃糖']::text[]),
  ('powdered sugar', 'Powdered sugar', '糖粉', 'Sucre glace', ARRAY['icing sugar', 'confectioners’ sugar', '糖霜粉', 'sucre à glacer']::text[]),
  ('cocoa powder', 'Cocoa powder', '可可粉', 'Cacao en poudre', ARRAY['poudre de cacao']::text[]),
  ('dark chocolate', 'Dark chocolate', '黑巧克力', 'Chocolat noir', ARRAY['黑朱古力']::text[]),
  ('vanilla extract', 'Vanilla extract', '香草精', 'Extrait de vanille', ARRAY['香荚兰精', '香莢蘭精']::text[]),
  ('mint', 'Mint', '薄荷', 'Menthe', ARRAY['mint leaves', 'feuilles de menthe', '薄荷叶', '薄荷葉']::text[]),
  ('rosemary', 'Rosemary', '迷迭香', 'Romarin', ARRAY[]::text[]),
  ('thyme', 'Thyme', '百里香', 'Thym', ARRAY[]::text[]),
  ('oregano', 'Oregano', '牛至', 'Origan', ARRAY[]::text[]),
  ('dill', 'Dill', '莳萝', 'Aneth', ARRAY['蒔蘿']::text[]),
  ('tarragon', 'Tarragon', '龙蒿', 'Estragon', ARRAY['龍蒿']::text[]),
  ('sage', 'Sage', '鼠尾草', 'Sauge', ARRAY[]::text[]),
  ('chives', 'Chives', '细香葱', 'Ciboulette', ARRAY['chive', '細香蔥']::text[]),
  ('garlic chives', 'Garlic chives', '韭菜', 'Ciboule de Chine', ARRAY['Chinese chives', 'ciboulette chinoise']::text[]),
  ('ground cumin', 'Ground cumin', '孜然粉', 'Cumin moulu', ARRAY['cumin powder']::text[]),
  ('coriander seeds', 'Coriander seeds', '芫荽籽', 'Graines de coriandre', ARRAY['coriander seed', 'graine de coriandre', '香菜籽']::text[]),
  ('nutmeg', 'Nutmeg', '肉豆蔻', 'Muscade', ARRAY['noix de muscade']::text[]),
  ('cloves', 'Cloves', '丁香', 'Clous de girofle', ARRAY['clou de girofle', '丁香粒']::text[]),
  ('cardamom', 'Cardamom', '小豆蔻', 'Cardamome', ARRAY['绿豆蔻', '綠豆蔻']::text[]),
  ('paprika', 'Paprika', '红椒粉', 'Paprika', ARRAY['紅椒粉', '甜椒粉']::text[]),
  ('curry powder', 'Curry powder', '咖喱粉', 'Poudre de cari', ARRAY['poudre de curry', '咖哩粉']::text[]),
  ('five-spice powder', 'Five-spice powder', '五香粉', 'Cinq-épices', ARRAY['Chinese five-spice powder', 'poudre de cinq épices']::text[]),
  ('fennel seeds', 'Fennel seeds', '小茴香籽', 'Graines de fenouil', ARRAY['fennel seed', 'graine de fenouil', '茴香籽']::text[]),
  ('saffron', 'Saffron', '藏红花', 'Safran', ARRAY['番红花', '番紅花', '藏紅花']::text[]),
  ('chicken breast', 'Chicken breast', '鸡胸肉', 'Blanc de poulet', ARRAY['chicken breasts', 'blancs de poulet', 'poitrine de poulet', '雞胸肉']::text[]),
  ('ground beef', 'Ground beef', '牛肉末', 'Bœuf haché', ARRAY['minced beef', '牛肉馅', '牛肉餡', '牛絞肉', '牛肉碎']::text[]),
  ('ground pork', 'Ground pork', '猪肉末', 'Porc haché', ARRAY['minced pork', '豬肉末', '猪肉馅', '豬肉餡', '豬絞肉']::text[]),
  ('ham', 'Ham', '火腿', 'Jambon', ARRAY[]::text[]),
  ('bacon', 'Bacon', '培根', 'Bacon', ARRAY['烟肉', '煙肉']::text[]),
  ('duck', 'Duck', '鸭肉', 'Canard', ARRAY['duck meat', '鴨肉']::text[]),
  ('turkey', 'Turkey', '火鸡肉', 'Dinde', ARRAY['turkey meat', '火雞肉']::text[]),
  ('tuna', 'Tuna', '金枪鱼', 'Thon', ARRAY['金槍魚', '鮪魚', '吞拿鱼', '吞拿魚']::text[]),
  ('cod', 'Cod', '鳕鱼', 'Cabillaud', ARRAY['鱈魚']::text[]),
  ('sardine', 'Sardine', '沙丁鱼', 'Sardine', ARRAY['sardines', '沙丁魚']::text[]),
  ('squid', 'Squid', '鱿鱼', 'Calmar', ARRAY['calmars', 'calamars', 'calamar', '魷魚']::text[]),
  ('mussels', 'Mussels', '贻贝', 'Moules', ARRAY['mussel', 'moule', '貽貝', '青口', '海虹']::text[]),
  ('oysters', 'Oysters', '牡蛎', 'Huîtres', ARRAY['oyster', 'huître', '牡蠣', '生蚝', '生蠔']::text[]),
  ('scallops', 'Scallops', '扇贝', 'Coquilles Saint-Jacques', ARRAY['scallop', 'coquille Saint-Jacques', 'pétoncles', 'pétoncle', '扇貝']::text[]),
  ('crab', 'Crab', '螃蟹', 'Crabe', ARRAY['crabs', 'crabes', '蟹']::text[]),
  ('fish sauce', 'Fish sauce', '鱼露', 'Sauce de poisson', ARRAY['魚露']::text[]),
  ('hoisin sauce', 'Hoisin sauce', '海鲜酱', 'Sauce hoisin', ARRAY['海鮮醬']::text[]),
  ('doubanjiang', 'Doubanjiang', '豆瓣酱', 'Pâte de fèves fermentées', ARRAY['douban jiang', '豆瓣醬']::text[]),
  ('sesame paste', 'Sesame paste', '芝麻酱', 'Pâte de sésame', ARRAY['芝麻醬']::text[]),
  ('tahini', 'Tahini', '塔希尼芝麻酱', 'Tahini', ARRAY['tahina', 'tahin', '塔希尼芝麻醬']::text[]),
  ('tomato paste', 'Tomato paste', '浓缩番茄膏', 'Concentré de tomates', ARRAY['tomato purée concentrate', 'concentré de tomate', '番茄膏', '濃縮番茄膏']::text[]),
  ('ketchup', 'Ketchup', '番茄沙司', 'Ketchup', ARRAY['tomato ketchup', '茄汁沙司', '番茄调味酱', '番茄調味醬']::text[]),
  ('mayonnaise', 'Mayonnaise', '蛋黄酱', 'Mayonnaise', ARRAY['mayo', '蛋黃醬', '美乃滋']::text[]),
  ('balsamic vinegar', 'Balsamic vinegar', '意大利香醋', 'Vinaigre balsamique', ARRAY['意大利黑醋', '義大利香醋', '巴萨米克醋', '巴薩米克醋']::text[]),
  ('miso', 'Miso', '味噌', 'Miso', ARRAY['miso paste', 'pâte de miso']::text[]),
  ('coconut cream', 'Coconut cream', '椰子浓浆', 'Crème de coco', ARRAY['椰子濃漿', '浓椰浆', '濃椰漿']::text[]),
  ('napa cabbage', 'Napa cabbage', '大白菜', 'Chou chinois', ARRAY['Chinese cabbage', 'chou de Pékin', '结球白菜', '結球白菜']::text[]),
  ('daikon', 'Daikon', '白萝卜', 'Radis blanc', ARRAY['daikon radish', 'radis daïkon', '白蘿蔔']::text[]),
  ('shiitake mushroom', 'Shiitake mushroom', '香菇', 'Shiitaké', ARRAY['shiitake mushrooms', 'shiitake', 'shiitakés', '冬菇']::text[]),
  ('wood ear mushroom', 'Wood ear mushroom', '木耳', 'Champignon noir chinois', ARRAY['wood ear mushrooms', 'wood ear fungus', '黑木耳']::text[]),
  ('enoki mushroom', 'Enoki mushroom', '金针菇', 'Enoki', ARRAY['enoki mushrooms', 'enokis', '金針菇']::text[]),
  ('lotus root', 'Lotus root', '莲藕', 'Racine de lotus', ARRAY['lotus roots', 'racines de lotus', '蓮藕', '藕']::text[]),
  ('bamboo shoots', 'Bamboo shoots', '竹笋', 'Pousses de bambou', ARRAY['bamboo shoot', 'pousse de bambou', '竹筍']::text[]),
  ('leek', 'Leek', '韭葱', 'Poireau', ARRAY['leeks', 'poireaux', '韭蔥']::text[]),
  ('shallot', 'Shallot', '红葱头', 'Échalote', ARRAY['shallots', 'échalotes', '紅蔥頭', '干葱头', '乾蔥頭']::text[]),
  ('cauliflower', 'Cauliflower', '花椰菜', 'Chou-fleur', ARRAY['cauliflowers', 'choux-fleurs', '菜花']::text[]),
  ('zucchini', 'Zucchini', '西葫芦', 'Courgette', ARRAY['zucchinis', 'courgettes', '西葫蘆', '栉瓜', '櫛瓜']::text[]),
  ('asparagus', 'Asparagus', '芦笋', 'Asperge', ARRAY['asperges', '蘆筍']::text[]),
  ('beet', 'Beet', '甜菜根', 'Betterave', ARRAY['beets', 'beetroot', 'betteraves', '红菜头', '紅菜頭']::text[]),
  ('pumpkin', 'Pumpkin', '南瓜', 'Citrouille', ARRAY['pumpkins', 'citrouilles']::text[]),
  ('kale', 'Kale', '羽衣甘蓝', 'Chou kale', ARRAY['kale leaves', 'chou frisé kale', '羽衣甘藍']::text[]),
  ('red bell pepper', 'Red bell pepper', '红甜椒', 'Poivron rouge', ARRAY['red bell peppers', 'poivrons rouges', '紅甜椒']::text[]),
  ('artichoke', 'Artichoke', '洋蓟', 'Artichaut', ARRAY['artichokes', 'artichauts', '洋薊', '朝鲜蓟', '朝鮮薊']::text[]),
  ('turnip', 'Turnip', '芜菁', 'Navet', ARRAY['turnips', 'navets', '蕪菁']::text[]),
  ('fennel bulb', 'Fennel bulb', '茴香球茎', 'Bulbe de fenouil', ARRAY['fennel bulbs', 'bulbes de fenouil', '球茎茴香', '球莖茴香']::text[]),
  ('peach', 'Peach', '桃子', 'Pêche', ARRAY['peaches', 'pêches', '桃']::text[]),
  ('pear', 'Pear', '梨', 'Poire', ARRAY['pears', 'poires', '梨子']::text[]),
  ('blueberries', 'Blueberries', '蓝莓', 'Myrtilles', ARRAY['blueberry', 'myrtille', 'bleuets', 'bleuet', '藍莓']::text[]),
  ('raspberries', 'Raspberries', '覆盆子', 'Framboises', ARRAY['raspberry', 'framboise', '树莓', '樹莓']::text[]),
  ('mango', 'Mango', '芒果', 'Mangue', ARRAY['mangoes', 'mangos', 'mangues']::text[]),
  ('pineapple', 'Pineapple', '菠萝', 'Ananas', ARRAY['pineapples', '菠蘿', '凤梨', '鳳梨']::text[]),
  ('grapes', 'Grapes', '葡萄', 'Raisin frais', ARRAY['grape', 'raisins frais']::text[]),
  ('raisins', 'Raisins', '葡萄干', 'Raisins secs', ARRAY['raisin sec', '葡萄乾']::text[]),
  ('lime', 'Lime', '青柠', 'Citron vert', ARRAY['limes', 'citrons verts', 'lime fruit', '青檸', '莱姆', '萊姆']::text[]),
  ('hazelnut', 'Hazelnut', '榛子', 'Noisette', ARRAY['hazelnuts', 'noisettes']::text[]),
  ('pistachio', 'Pistachio', '开心果', 'Pistache', ARRAY['pistachios', 'pistaches', '開心果']::text[])
) AS vocabulary(canonical_name, en, zh, fr, aliases);

INSERT INTO ingredient_profiles (canonical_name, classification)
SELECT canonical_name, 'UNKNOWN' FROM multilingual_ingredient_seed ON CONFLICT DO NOTHING;
INSERT INTO ingredient_translations (canonical_name, en, zh, fr)
SELECT canonical_name, en, zh, fr FROM multilingual_ingredient_seed;

-- DISTINCT collapses equivalent spellings on the same ingredient. The primary key
-- rejects a spelling assigned to two different ingredients.
INSERT INTO ingredient_aliases (name, canonical_name)
SELECT DISTINCT ingredient_alias_key(spelling), canonical_name
FROM multilingual_ingredient_seed
CROSS JOIN LATERAL unnest(ARRAY[canonical_name, en, zh, fr] || aliases) AS names(spelling);
DROP TABLE multilingual_ingredient_seed;

CREATE OR REPLACE FUNCTION resolve_recipe_ingredient_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT a.canonical_name INTO NEW.canonical_name
  FROM ingredient_aliases a WHERE a.name = ingredient_alias_key(NEW.name);
  IF NOT FOUND THEN
    NEW.canonical_name := lower(btrim(NEW.name));
    INSERT INTO ingredient_profiles (canonical_name, classification)
    VALUES (NEW.canonical_name, 'UNKNOWN') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- An exact alias expands from its identity so every translation returns the same set.
-- Latin word boundaries distinguish egg whites from eggplant. Cooks can write Chinese
-- compound names without spaces, so look for Han aliases inside unlisted names.
CREATE FUNCTION matching_ingredient_names(search_text text) RETURNS TABLE(canonical_name text)
LANGUAGE sql STABLE STRICT AS $$
  WITH term AS (
    SELECT ingredient_alias_key(search_text) AS key
  ), identity AS (
    SELECT a.canonical_name FROM ingredient_aliases a JOIN term ON a.name = term.key
  ), patterns AS (
    SELECT i.canonical_name,
      '(^|[^a-z0-9])(' ||
        string_agg(regexp_replace(a.name COLLATE "C", '[^a-z0-9]+', '[^a-z0-9]+', 'g'), '|')
          FILTER (WHERE octet_length(a.name) = char_length(a.name) AND a.name COLLATE "C" ~ '[a-z0-9]') ||
        ')([^a-z0-9]|$)' AS latin_words,
      array_agg(a.name) FILTER (WHERE octet_length(a.name) > char_length(a.name)) AS han_names
    FROM identity i JOIN ingredient_aliases a USING (canonical_name)
    GROUP BY i.canonical_name
  )
  SELECT p.canonical_name::text
  FROM patterns JOIN ingredient_profiles p ON true
  LEFT JOIN ingredient_translations t ON t.canonical_name = p.canonical_name
  WHERE p.canonical_name = patterns.canonical_name
    OR ingredient_alias_key(p.canonical_name) COLLATE "C" ~ patterns.latin_words
    OR (t.canonical_name IS NULL AND EXISTS (
      SELECT 1 FROM unnest(patterns.han_names) AS han(name)
      WHERE strpos(ingredient_alias_key(p.canonical_name), han.name) > 0
    ))
  UNION
  SELECT a.canonical_name::text FROM ingredient_aliases a, term
  WHERE term.key <> '' AND NOT EXISTS (SELECT 1 FROM identity) AND strpos(a.name, term.key) > 0
  UNION
  SELECT p.canonical_name::text FROM ingredient_profiles p, term
  WHERE term.key <> '' AND NOT EXISTS (SELECT 1 FROM identity)
    AND NOT EXISTS (SELECT 1 FROM ingredient_translations t WHERE t.canonical_name = p.canonical_name)
    AND strpos(ingredient_alias_key(p.canonical_name), term.key) > 0
$$;

-- Schema-qualified Prisma writes also work when the connection has a different search_path.
DO $paths$
DECLARE
  schema_name text := current_schema();
BEGIN
  EXECUTE format('ALTER FUNCTION %I.resolve_recipe_ingredient_name() SET search_path TO pg_catalog, %I, pg_temp',
                 schema_name, schema_name);
  EXECUTE format('ALTER FUNCTION %I.matching_ingredient_names(text) SET search_path TO pg_catalog, %I, pg_temp',
                 schema_name, schema_name);
END;
$paths$;

-- Acquire the trigger's table lock before migrating existing rows, including any
-- inserts or renames from the old application that were in flight.
CREATE OR REPLACE TRIGGER recipe_ingredients_resolve_name BEFORE INSERT OR UPDATE OF name, canonical_name
ON recipe_ingredients FOR EACH ROW EXECUTE FUNCTION resolve_recipe_ingredient_name();

-- Keep all recorded allergen links. If old profiles disagree, keep the dietary
-- restriction that flags the most conflicts, retaining uncertainty for NON_VEGAN.
INSERT INTO ingredient_allergens (canonical_name, allergen)
SELECT DISTINCT a.canonical_name, old.allergen
FROM ingredient_allergens old JOIN ingredient_aliases a ON a.name = ingredient_alias_key(old.canonical_name)
WHERE old.canonical_name <> a.canonical_name
ON CONFLICT DO NOTHING;

WITH classifications AS (
  SELECT DISTINCT ON (a.canonical_name) a.canonical_name, p.classification
  FROM ingredient_profiles p JOIN ingredient_aliases a ON a.name = ingredient_alias_key(p.canonical_name)
  WHERE p.classification <> 'UNKNOWN'
  ORDER BY a.canonical_name,
    array_position(ARRAY['NON_VEGETARIAN','NON_VEGAN','VEGETARIAN','VEGAN']::"IngredientDiet"[], p.classification)
)
UPDATE ingredient_profiles p SET classification = c.classification
FROM classifications c WHERE p.canonical_name = c.canonical_name AND p.classification <> c.classification;

UPDATE recipe_ingredients i SET canonical_name = a.canonical_name
FROM ingredient_aliases a
WHERE ingredient_alias_key(i.name) = a.name AND i.canonical_name <> a.canonical_name;

DELETE FROM ingredient_profiles p USING ingredient_aliases a
WHERE a.name = ingredient_alias_key(p.canonical_name) AND p.canonical_name <> a.canonical_name;
