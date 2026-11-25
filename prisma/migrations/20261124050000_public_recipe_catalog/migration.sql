-- Snapshot of the 16 public recipes in the local demo. Stable UUIDs retain the
-- published recipe and photograph attributions. Seed JPEGs use the same object
-- keys in each store. File bytes are provisioned separately from PostgreSQL.
-- One statement keeps the import atomic, including its identity checks.
DO $catalog$
DECLARE
  cook record;
  dish record;
  cook_id uuid;
  dish_id uuid;
  cover_id uuid;
  cover_path text;
  existing_author uuid;
BEGIN
  FOR cook IN
    SELECT * FROM (VALUES
      (1, 'Mira Patel', 'rachel@public-fixtures.savor.invalid', 'rachel@savor.local'),
      (2, 'Theo Bennett', 'grace@public-fixtures.savor.invalid', 'grace@savor.local'),
      (3, 'Nina Flores', 'nina.flores@public-fixtures.savor.invalid', 'nina@savor.local'),
      (4, 'Elias Park', 'elias.park@public-fixtures.savor.invalid', 'elias@savor.local'),
      (5, 'Amara Ellis', 'amara.ellis@public-fixtures.savor.invalid', 'amara@savor.local'),
      (6, 'Luca Moreno', 'luca.moreno@public-fixtures.savor.invalid', 'luca@savor.local'),
      (7, 'Iris Brooks', 'iris.brooks@public-fixtures.savor.invalid', 'iris@savor.local'),
      (8, 'Felix Ward', 'felix.ward@public-fixtures.savor.invalid', 'felix@savor.local')
    ) AS cooks(slot, name, email, local_email)
  LOOP
    cook_id := ('10000000-0000-4000-8000-' || lpad(cook.slot::text, 12, '0'))::uuid;
    INSERT INTO users (id, name, email) VALUES (cook_id, cook.name, cook.email)
      ON CONFLICT (id) DO NOTHING;
    -- Earlier cloud and loopback seeds used different reserved email addresses.
    IF NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = cook_id AND u.email IN (cook.email, cook.local_email)
      FOR SHARE
    ) THEN
      RAISE EXCEPTION 'Public recipe catalog: cook ID % belongs to a different user', cook_id;
    END IF;
  END LOOP;

  FOR dish IN
    SELECT * FROM (VALUES
      (1, 1, 'Lemon & basil pasta',
       'Lemon zest, garlic and a splash of pasta water make the sauce. Toss in torn basil just before serving.',
       4, 10, 15, 'pasta.jpg', 174796,
       $ingredients$[
        ["Pasta",400,"g",null],
        ["Fresh basil",30,"g",null],
        ["Olive oil",60,"ml",null],
        ["Parmesan",80,"g","Finely grated"],
        ["Lemon",1,"count","Zest and juice"],
        ["Garlic",2,"count","Cloves, finely sliced"],
        ["Sea salt",null,null,"To taste"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Bring a large pot of generously salted water to a boil. Add the pasta and cook until al dente, following the packet instructions. Reserve a mug of pasta water before draining.',
        'Warm the olive oil in a wide pan over medium-low heat. Add the sliced garlic and stir for 1–2 minutes until fragrant. Keep it pale rather than golden.',
        'Add the drained pasta, lemon zest and juice, and a splash of the reserved pasta water. Toss vigorously until the sauce looks glossy.',
        'Take the pan off the heat. Fold in the parmesan and torn basil, loosening with a little more pasta water as needed. Taste, season, and serve right away.'
       ]),
      (2, 2, 'The everyday green bowl',
       'Roast the chickpeas until crisp, then toss them with cucumber, greens and lemon dressing.',
       2, 15, 20, 'salad.jpg', 244343,
       $ingredients$[
        ["Chickpeas",400,"g","Drained"],
        ["Mixed greens",150,"g",null],
        ["Cucumber",1,"count",null],
        ["Olive oil",30,"ml",null],
        ["Lemon juice",30,"ml",null],
        ["Salt",null,null,"To taste"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Pat the chickpeas dry. Toss with half the oil and a pinch of salt. Roast at 200°C for 20 minutes until crisp.',
        'Wash and dry the greens. Slice the cucumber and arrange in bowls.',
        'Whisk the remaining oil with lemon juice. Add the warm chickpeas to the greens, drizzle with dressing, and toss.'
       ]),
      (3, 1, 'Slow Sunday pancakes',
       'A stack of small, buttery pancakes to serve with fruit or maple syrup.',
       4, 10, 15, 'pancakes.jpg', 161703,
       $ingredients$[
        ["Plain flour",400,"g",null],
        ["Milk",500,"ml",null],
        ["Eggs",2,"count",null],
        ["Sugar",30,"g",null],
        ["Baking powder",2,"tsp",null],
        ["Butter",40,"g","Melted"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Whisk the flour, sugar, and baking powder in a large bowl.',
        'In a second bowl, beat the eggs with the milk and cooled melted butter. Fold into the dry ingredients just until combined; a few lumps are fine.',
        'Warm a lightly buttered frying pan over medium heat. Add small ladles of batter. Cook until bubbles appear, then flip and cook the other side until golden.',
        'Serve warm with fruit and maple syrup.'
       ]),
      (4, 2, 'Roasted tomato soup',
       'Roast the tomatoes and onion before blending them with stock. Stir in the cream at the end.',
       4, 10, 40, 'soup.jpg', 263397,
       $ingredients$[
        ["Tomatoes",1000,"g",null],
        ["Onion",1,"count",null],
        ["Vegetable stock",600,"ml",null],
        ["Cream",100,"ml",null],
        ["Olive oil",30,"ml",null],
        ["Salt",null,null,"To taste"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Heat the oven to 200°C. Halve the tomatoes and quarter the onion. Place on a tray with the olive oil and season.',
        'Roast for 30 minutes until softened and caramelized at the edges.',
        'Transfer to a pot, add the stock, and simmer for 10 minutes. Blend until smooth, then stir in the cream. Taste and season.'
       ]),
      (5, 1, 'Avocado toast, a little extra',
       'Toasted sourdough topped with lemony avocado, a seven-minute egg and chili flakes.',
       2, 10, 7, 'toast.jpg', 124428,
       $ingredients$[
        ["Sourdough bread",2,"count","Slices"],
        ["Avocado",1,"count",null],
        ["Eggs",2,"count",null],
        ["Lemon juice",15,"ml",null],
        ["Chili flakes",null,null,"A pinch"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Bring a small saucepan of water to a gentle boil. Lower in the eggs and cook for 7 minutes. Cool briefly under cold water and peel.',
        'Toast the sourdough. Mash the avocado with lemon juice and a pinch of salt.',
        'Spread the avocado on the toast, top with halved eggs, and finish with chili flakes.'
       ]),
      (6, 2, 'Ginger sesame grain bowl',
       'Brown rice, steamed broccoli and carrots with a soy, ginger and sesame dressing.',
       3, 15, 20, 'bowl.jpg', 350338,
       $ingredients$[
        ["Brown rice",240,"g",null],
        ["Broccoli",300,"g",null],
        ["Carrot",2,"count",null],
        ["Soy sauce",30,"ml",null],
        ["Sesame oil",15,"ml",null],
        ["Ginger",15,"g","Finely grated"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Cook the rice according to the package directions.',
        'Cut the broccoli into florets and slice the carrots. Steam for 5–7 minutes until tender with a little bite.',
        'Whisk the soy sauce, sesame oil, and ginger. Divide the warm rice and vegetables among bowls and spoon over the dressing.'
       ]),
      (7, 1, 'Basil pesto for the week',
       'Basil pesto with toasted pine nuts, garlic and Parmesan. Spoon it over pasta or spread it on toast.',
       6, 10, 0, 'pasta.jpg', 174796,
       $ingredients$[
        ["Basil",60,"g",null],
        ["Olive oil",120,"ml",null],
        ["Parmesan",60,"g",null],
        ["Pine nuts",40,"g",null],
        ["Garlic",1,"count","Clove"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Toast the pine nuts in a dry pan until lightly golden. Leave to cool.',
        'Blend the basil, garlic, pine nuts, and parmesan. Stream in the olive oil until you reach a loose paste. Season to taste.'
       ]),
      (9, 3, 'Red lentil dal with sizzling cumin',
       'Red lentils soften into a golden dal while the onions brown in a second pan. Swirl the cumin-scented onions through each bowl just before serving.',
       4, 10, 25, 'red-lentil-dal.jpg', 144535,
       $ingredients$[
        ["Split red lentils",250,"g","Rinsed and drained"],
        ["Water",850,"ml",null],
        ["Ground turmeric",0.5,"tsp",null],
        ["Ginger",10,"g","Finely grated"],
        ["Onion",1,"count","Thinly sliced"],
        ["Neutral oil",20,"ml",null],
        ["Cumin seeds",1,"tsp",null],
        ["Salt",0.5,"tsp",null],
        ["Lemon juice",15,"ml",null]
       ]$ingredients$::jsonb,
       ARRAY[
        'Put the lentils, water, turmeric and ginger in a saucepan. Bring to a boil, skim off any foam and lower the heat.',
        'Simmer with the lid ajar for 18–22 minutes. Stir near the end, crushing a spoonful of lentils against the side of the pan to thicken the dal.',
        'Meanwhile, heat the oil in a skillet over medium heat. Add the cumin seeds. When they sizzle, add the onion and cook for 10–12 minutes, stirring until golden.',
        'Season the lentils with salt and lemon juice. Spoon into bowls and swirl a little cumin oil and onion into each serving.'
       ]),
      (10, 4, 'Papaya and banana batido',
       'Ripe papaya gives this chilled yogurt drink its coral colour. A squeeze of lime balances the banana''s sweetness.',
       2, 5, 0, 'papaya-batido.jpg', 138231,
       $ingredients$[
        ["Papaya",250,"g","Peeled, seeded flesh"],
        ["Banana",1,"count","Ripe and peeled"],
        ["Plain yogurt",150,"g",null],
        ["Cold milk",120,"ml",null],
        ["Lime juice",10,"ml",null],
        ["Ice cubes",4,"count",null]
       ]$ingredients$::jsonb,
       ARRAY[
        'Cut the papaya and banana into chunks. Pour the milk into a blender, then add the yogurt, fruit and lime juice.',
        'Blend until smooth. Add the ice and blend again until the drink pours easily and no pieces of ice remain.',
        'Divide between glasses and serve cold.'
       ]),
      (11, 5, 'Lemon and scallion salmon cakes',
       'Canned salmon makes a quick lunch with a crisp breadcrumb crust. Chilling the patties briefly helps them keep their shape in the skillet.',
       3, 20, 10, 'salmon-cakes.jpg', 144608,
       $ingredients$[
        ["Canned salmon",340,"g","Drained weight"],
        ["Breadcrumbs",60,"g","Divided between filling and crust"],
        ["Egg",1,"count",null],
        ["Scallions",2,"count","Thinly sliced"],
        ["Lemon",1,"count","Zested and cut into wedges"],
        ["Dijon mustard",2,"tsp",null],
        ["Neutral oil",20,"ml",null]
       ]$ingredients$::jsonb,
       ARRAY[
        'Flake the drained salmon into a bowl. Beat the egg with the mustard and lemon zest, then fold it into the salmon with the scallions and half the breadcrumbs.',
        'Form six even patties about 1.5 cm thick. Press both faces into the remaining crumbs and refrigerate for 10 minutes.',
        'Heat the oil in a wide skillet over medium heat. Fry the cakes for 4–5 minutes per side until crisp and hot through. The centres should reach 71°C.',
        'Serve two cakes per person with the lemon wedges.'
       ]),
      (12, 6, 'Tomato and egg stir-fry',
       'Soft folds of scrambled egg catch the juices from ripe tomatoes. Cook the eggs first so they stay tender while the tomatoes break down.',
       2, 5, 8, 'tomato-eggs.jpg', 100645,
       $ingredients$[
        ["Tomatoes",350,"g","Cut into small wedges"],
        ["Eggs",4,"count",null],
        ["Scallions",2,"count","Keep sliced whites and greens separate"],
        ["Neutral oil",15,"ml",null],
        ["Water",15,"ml",null],
        ["Salt",0.25,"tsp",null]
       ]$ingredients$::jsonb,
       ARRAY[
        'Beat the eggs with half the salt. Warm half the oil in a skillet over medium heat. Pour in the eggs and push the set edges towards the centre to make broad curds. Slide the just-set eggs onto a plate.',
        'Add the remaining oil and the scallion whites to the pan. Stir for 30 seconds, then add the tomatoes, water and remaining salt. Cook for 3–4 minutes, crushing a few wedges to release their juices.',
        'Return the eggs to the pan and fold gently until coated in tomato and steaming. Scatter the scallion greens over the top.'
       ]),
      (13, 7, 'Cheese pupusas with crunchy cabbage slaw',
       'Warm masa cakes enclose a pocket of melted cheese. Make the lime and vinegar slaw first so the cabbage softens slightly while the pupusas cook.',
       4, 25, 20, 'cheese-pupusas.jpg', 164577,
       $ingredients$[
        ["Green cabbage",180,"g","Finely shredded"],
        ["Carrot",1,"count","Grated"],
        ["Apple cider vinegar",30,"ml",null],
        ["Lime juice",15,"ml",null],
        ["Dried oregano",0.5,"tsp",null],
        ["Salt",0.75,"tsp","Divided"],
        ["Masa harina",200,"g","Nixtamalized corn flour"],
        ["Warm water",290,"ml","Add gradually"],
        ["Low-moisture mozzarella",120,"g","Grated"],
        ["Neutral oil",10,"ml","For the pan and hands"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Toss the cabbage and carrot with the vinegar, lime juice, oregano and one-third of the salt. Squeeze gently with clean hands and set aside.',
        'Combine the masa harina and remaining salt. Work in the warm water gradually until the dough feels soft and holds together. Cover for 5 minutes, then divide into eight balls.',
        'With lightly oiled hands, press a hollow into each ball. Add an eighth of the cheese, close the dough around it and pat into a disc about 1 cm thick. Pinch any cracks closed.',
        'Lightly oil a skillet over medium heat. Cook in two batches for 4–5 minutes per side, until speckled brown and hot in the centre. Top with slaw just before eating.'
       ]),
      (14, 8, 'Chicken and okra gumbo',
       'A copper-coloured roux gives the broth a toasted flavour. Sliced okra thickens the pot as the chicken simmers.',
       4, 15, 50, 'chicken-gumbo.jpg', 146081,
       $ingredients$[
        ["Neutral oil",40,"ml",null],
        ["Plain flour",35,"g",null],
        ["Onion",1,"count","Diced"],
        ["Green bell pepper",1,"count","Diced"],
        ["Celery",2,"count","Stalks, diced"],
        ["Garlic",2,"count","Cloves, chopped"],
        ["Smoked paprika",1,"tsp",null],
        ["Dried thyme",1,"tsp",null],
        ["Chicken stock",850,"ml",null],
        ["Chicken thighs",450,"g","Boneless, skinless, cut in bite-sized pieces"],
        ["Okra",200,"g","Fresh or frozen, sliced"],
        ["Cooked rice",500,"g","Hot, for serving"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Whisk the oil and flour together in a heavy pot over medium-low heat. Stir constantly, scraping the corners, for 12–15 minutes until the mixture is copper brown and smells toasted.',
        'Add the onion, pepper and celery. Cook for 5 minutes, stirring frequently, then add the garlic, paprika and thyme and stir for 30 seconds.',
        'Slowly pour in the stock, stirring until smooth. Add the chicken and okra. Bring to a simmer and cook gently for 20–25 minutes, until the okra is tender and the chicken reaches 74°C in the centre.',
        'Spoon hot rice into bowls and ladle the gumbo around it.'
       ]),
      (15, 1, 'Shaanxi hot-oil noodles (陕西油泼面)',
       'Frank17008’s recipe in HowToCook follows the Guanzhong style of Shaanxi. Hot oil poured over ground chiles, garlic and scallion seasons a bowl of chewy noodles.',
       1, 0, 0, 'shaanxi-oil-noodles.jpg', 44137,
       $ingredients$[
        ["Fresh noodles",null,null,"Preferably 3–4 long hand-pulled noodles per person, or more to suit your appetite"],
        ["Salt",2,"g","The ingredient list gives 2 g. The method specifies 1 g for the cooking water."],
        ["Scallion",1,"count",null],
        ["Garlic",3,"count","Cloves"],
        ["Ground dried chiles",15,"g","Shaanxi Qin chile powder can be used"],
        ["Cooking oil",50,"ml",null],
        ["Light soy sauce",10,"ml",null],
        ["Chinese aromatic vinegar",5,"ml",null],
        ["Leafy greens",50,"g","Bok choy or spinach"],
        ["Bean sprouts",50,"g","Optional"],
        ["Sesame seeds",null,null,"Optional, a little"],
        ["Sichuan peppercorns",null,null,"Optional, for infusing the oil"],
        ["Star anise",null,null,"Optional, for infusing the oil"],
        ["Cassia bark",null,null,"Optional, for infusing the oil"],
        ["Bay leaf",null,null,"Optional, for infusing the oil"]
       ]$ingredients$::jsonb,
       ARRAY[
        'If using hand-pulled noodles, lightly press the two edges with a rolling pin or your hands. Take an end in each hand and pull the noodle gently apart.',
        'Chop the scallion and mince the garlic. Wash the greens and the bean sprouts, if using.',
        'Bring a pot of water to a boil over high heat and add 1 g salt. Add the noodles, stir gently with chopsticks to keep them apart, and cook for another 1–2 minutes after they float.',
        'Add the greens and any sprouts for the last minute. Lift out the noodles and vegetables, drain and place in a bowl.',
        'Add the light soy sauce, aromatic vinegar, scallion, garlic and ground chiles, in that order. Add a little sesame if you like.',
        'Pour the cooking oil into a wok. If using the Sichuan peppercorns, star anise, cassia or bay leaf, warm them in the oil over low heat until fragrant, then remove them.',
        'When the oil just begins to smoke, pour it quickly and evenly over the ground chiles until they sizzle. Toss the noodles and seasonings together with chopsticks.'
       ]),
      (16, 2, 'Hunan home-style red-braised pork (湖南家常红烧肉)',
       'In xiaolizi’s HowToCook recipe, skin-on pork belly takes its colour from rock-sugar caramel and two soy sauces, then simmers until tender.',
       2, 0, 0, 'hunan-braised-pork.jpg', 153466,
       $ingredients$[
        ["Skin-on pork belly",500,"g",null],
        ["Cooking oil",10,"g",null],
        ["Bay leaves",5,"count","Listed in the original ingredients. The source does not specify when to add them."],
        ["Ginger",3,"count","Slices"],
        ["Cassia bark",1,"count","Small piece"],
        ["Rock sugar",6,"count","Pieces"],
        ["Chinese cooking wine",20,"g",null],
        ["Light soy sauce",5,"g",null],
        ["Dark soy sauce",2,"g",null],
        ["Salt",2,"g",null],
        ["Star anise",3,"count","Whole stars"],
        ["Small dried hot chiles",null,null,"To taste"],
        ["Boiling water",null,null,"Enough to cover the pork for braising"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Rinse the skin-on pork belly and put it in a pot of cold water with 2–3 slices of ginger. Bring to a boil, lift out the pork and rinse off the foam with cold water.',
        'Cut the pork into pieces about 1.5 cm across.',
        'Heat the oil in a pan, add the rock sugar and stir over low heat until caramel-coloured. Add the pork and stir-fry over medium heat to colour it.',
        'Add the prepared ginger, star anise, cassia, light and dark soy sauces, cooking wine, dried chiles and salt. Stir-fry over low heat for 1 minute, then add enough boiling water to cover the pork.',
        'Cover, bring to a boil over medium heat, then turn the heat to low and simmer for 30 minutes. Stir every 10 minutes to prevent sticking.',
        'When about a third of the braising liquid remains, raise the heat to medium and reduce the sauce before serving.'
       ]),
      (17, 3, 'Chinese steamed egg custard (鸡蛋羹)',
       'ZhangGaoxing and the HowToCook contributors published this one-person recipe for water-steamed eggs (水蒸蛋), finished with sesame oil and light soy sauce. The source gives about 15 minutes overall.',
       1, 0, 0, 'chinese-steamed-egg.jpg', 90612,
       $ingredients$[
        ["Eggs",2,"count",null],
        ["Salt",3,"g",null],
        ["Sesame oil",null,null,"2–4 ml. Green Sichuan pepper oil can be used instead."],
        ["Light soy sauce",8,"ml","Or Weijixian seasoning sauce"],
        ["White vinegar",2,"ml","Optional. Cooking wine can be used instead."],
        ["Purified water",null,null,"At 70°C, measure 1–1.5 times the volume of the beaten eggs"],
        ["Water for steaming",50,"ml","For the pan"]
       ]$ingredients$::jsonb,
       ARRAY[
        'Beat the eggs in a bowl and add the salt. If using, stir in the white vinegar or cooking wine. Rice vinegar also works but can darken the eggs slightly.',
        'Stir in the 70°C water. An equal volume of water makes a firmer custard. For a softer custard, use one and a half times the egg volume.',
        'If you want a smooth surface, strain the mixture to remove the foam.',
        'Bring the 50 ml water to a boil in a pan and set the bowl of egg mixture inside. Cover the bowl with a lid, an inverted metal saucer or wrap to keep condensation out.',
        'Steam over medium heat for 10 minutes. Turn off the heat and leave the bowl covered for another 5 minutes.',
        'Remove the bowl and finish the custard with sesame oil and light soy sauce. The source also suggests green Sichuan pepper oil in place of sesame oil.'
       ])
    ) AS dishes(slot, author_slot, title, description, servings, prep, cook_time, filename, byte_size, ingredients, steps)
  LOOP
    cook_id := ('10000000-0000-4000-8000-' || lpad(dish.author_slot::text, 12, '0'))::uuid;
    dish_id := ('20000000-0000-4000-8000-' || lpad(dish.slot::text, 12, '0'))::uuid;
    cover_id := ('30000000-0000-4000-8000-' || lpad(dish.slot::text, 12, '0'))::uuid;
    cover_path := 'seed/' || cover_id::text || '.jpg';

    SELECT r.author_id INTO existing_author FROM recipes r WHERE r.id = dish_id FOR SHARE;
    IF FOUND THEN
      IF existing_author <> cook_id THEN
        RAISE EXCEPTION 'Public recipe catalog: recipe ID % belongs to a different author', dish_id;
      END IF;
      -- Keep the existing recipe, including its visibility, cover, and any edits.
      CONTINUE;
    END IF;

    INSERT INTO files (id, owner_id, name, pathname, content_type, size)
    VALUES (cover_id, cook_id, dish.filename, cover_path, 'image/jpeg', dish.byte_size)
    ON CONFLICT (id) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM files f
      WHERE f.id = cover_id AND f.owner_id = cook_id AND f.pathname = cover_path
        AND f.name = dish.filename AND f.content_type = 'image/jpeg' AND f.size = dish.byte_size
      FOR SHARE
    ) THEN
      RAISE EXCEPTION 'Public recipe catalog: existing cover metadata differs for %', cover_id;
    END IF;

    INSERT INTO recipes (id, author_id, title, description, base_servings, prep_minutes, cook_minutes,
                         difficulty, visibility, cover_file_id, created_at)
    VALUES (dish_id, cook_id, dish.title, dish.description, dish.servings, dish.prep, dish.cook_time,
            'EASY', 'PUBLIC', cover_id, TIMESTAMPTZ '2026-11-08 17:00:00+00' - (dish.slot - 1) * INTERVAL '1 minute');

    -- Ingredient tuple fields match the local seed: name, quantity, unit, note.
    INSERT INTO recipe_ingredients (recipe_id, position, name, canonical_name, quantity, unit, note)
    SELECT dish_id, ordinal - 1, item->>0, lower(item->>0), (item->>1)::numeric, item->>2, item->>3
    FROM jsonb_array_elements(dish.ingredients) WITH ORDINALITY AS ingredients(item, ordinal);

    INSERT INTO recipe_steps (recipe_id, position, instruction)
    SELECT dish_id, ordinal - 1, instruction
    FROM unnest(dish.steps) WITH ORDINALITY AS steps(instruction, ordinal);
  END LOOP;
END
$catalog$;
