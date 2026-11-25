import { publishedChineseRecipes } from "./published-chinese-recipes";

// The first two local email addresses also serve as the integration-test logins.
export const demoAuthors = [
  { slot: 1, name: "Mira Patel", localEmail: "rachel@savor.local", publicEmail: "rachel@public-fixtures.savor.invalid" },
  { slot: 2, name: "Theo Bennett", localEmail: "grace@savor.local", publicEmail: "grace@public-fixtures.savor.invalid" },
  { slot: 3, name: "Nina Flores", localEmail: "nina@savor.local", publicEmail: "nina.flores@public-fixtures.savor.invalid" },
  { slot: 4, name: "Elias Park", localEmail: "elias@savor.local", publicEmail: "elias.park@public-fixtures.savor.invalid" },
  { slot: 5, name: "Amara Ellis", localEmail: "amara@savor.local", publicEmail: "amara.ellis@public-fixtures.savor.invalid" },
  { slot: 6, name: "Luca Moreno", localEmail: "luca@savor.local", publicEmail: "luca.moreno@public-fixtures.savor.invalid" },
  { slot: 7, name: "Iris Brooks", localEmail: "iris@savor.local", publicEmail: "iris.brooks@public-fixtures.savor.invalid" },
  { slot: 8, name: "Felix Ward", localEmail: "felix@savor.local", publicEmail: "felix.ward@public-fixtures.savor.invalid" },
];

// Slots keep author, recipe, and cover links stable when the catalog changes order.
export function demoId(kind: "author" | "recipe" | "cover", slot: number) {
  const prefix = { author: "10000000", recipe: "20000000", cover: "30000000" }[kind];
  return `${prefix}-0000-4000-8000-${String(slot).padStart(12, "0")}`;
}

export type DemoRecipe = {
  slot: number;
  authorSlot: number;
  isPrivate?: true;
  title: string;
  description: string;
  photo: string;
  servings: number;
  prep: number;
  cook: number;
  ingredients: [string, number | null, string | null, string | null][];
  steps: string[];
};
export const demoRecipes: DemoRecipe[] = [
  {
    slot: 1,
    authorSlot: 1,
    title: "Lemon & basil pasta",
    description:
      "Lemon zest, garlic and a splash of pasta water make the sauce. Toss in torn basil just before serving.",
    photo: "pasta",
    servings: 4,
    prep: 10,
    cook: 15,
    ingredients: [
      ["Pasta", 400, "g", null],
      ["Fresh basil", 30, "g", null],
      ["Olive oil", 60, "ml", null],
      ["Parmesan", 80, "g", "Finely grated"],
      ["Lemon", 1, "count", "Zest and juice"],
      ["Garlic", 2, "count", "Cloves, finely sliced"],
      ["Sea salt", null, null, "To taste"],
    ],
    steps: [
      "Bring a large pot of generously salted water to a boil. Add the pasta and cook until al dente, following the packet instructions. Reserve a mug of pasta water before draining.",
      "Warm the olive oil in a wide pan over medium-low heat. Add the sliced garlic and stir for 1–2 minutes until fragrant. Keep it pale rather than golden.",
      "Add the drained pasta, lemon zest and juice, and a splash of the reserved pasta water. Toss vigorously until the sauce looks glossy.",
      "Take the pan off the heat. Fold in the parmesan and torn basil, loosening with a little more pasta water as needed. Taste, season, and serve right away.",
    ],
  },
  {
    slot: 2,
    authorSlot: 2,
    title: "The everyday green bowl",
    description:
      "Roast the chickpeas until crisp, then toss them with cucumber, greens and lemon dressing.",
    photo: "salad",
    servings: 2,
    prep: 15,
    cook: 20,
    ingredients: [
      ["Chickpeas", 400, "g", "Drained"],
      ["Mixed greens", 150, "g", null],
      ["Cucumber", 1, "count", null],
      ["Olive oil", 30, "ml", null],
      ["Lemon juice", 30, "ml", null],
      ["Salt", null, null, "To taste"],
    ],
    steps: [
      "Pat the chickpeas dry. Toss with half the oil and a pinch of salt. Roast at 200°C for 20 minutes until crisp.",
      "Wash and dry the greens. Slice the cucumber and arrange in bowls.",
      "Whisk the remaining oil with lemon juice. Add the warm chickpeas to the greens, drizzle with dressing, and toss.",
    ],
  },
  {
    slot: 3,
    authorSlot: 1,
    title: "Slow Sunday pancakes",
    description:
      "A stack of small, buttery pancakes to serve with fruit or maple syrup.",
    photo: "pancakes",
    servings: 4,
    prep: 10,
    cook: 15,
    ingredients: [
      ["Plain flour", 400, "g", null],
      ["Milk", 500, "ml", null],
      ["Eggs", 2, "count", null],
      ["Sugar", 30, "g", null],
      ["Baking powder", 2, "tsp", null],
      ["Butter", 40, "g", "Melted"],
    ],
    steps: [
      "Whisk the flour, sugar, and baking powder in a large bowl.",
      "In a second bowl, beat the eggs with the milk and cooled melted butter. Fold into the dry ingredients just until combined; a few lumps are fine.",
      "Warm a lightly buttered frying pan over medium heat. Add small ladles of batter. Cook until bubbles appear, then flip and cook the other side until golden.",
      "Serve warm with fruit and maple syrup.",
    ],
  },
  {
    slot: 4,
    authorSlot: 2,
    title: "Roasted tomato soup",
    description:
      "Roast the tomatoes and onion before blending them with stock. Stir in the cream at the end.",
    photo: "soup",
    servings: 4,
    prep: 10,
    cook: 40,
    ingredients: [
      ["Tomatoes", 1000, "g", null],
      ["Onion", 1, "count", null],
      ["Vegetable stock", 600, "ml", null],
      ["Cream", 100, "ml", null],
      ["Olive oil", 30, "ml", null],
      ["Salt", null, null, "To taste"],
    ],
    steps: [
      "Heat the oven to 200°C. Halve the tomatoes and quarter the onion. Place on a tray with the olive oil and season.",
      "Roast for 30 minutes until softened and caramelized at the edges.",
      "Transfer to a pot, add the stock, and simmer for 10 minutes. Blend until smooth, then stir in the cream. Taste and season.",
    ],
  },
  {
    slot: 5,
    authorSlot: 1,
    title: "Avocado toast, a little extra",
    description:
      "Toasted sourdough topped with lemony avocado, a seven-minute egg and chili flakes.",
    photo: "toast",
    servings: 2,
    prep: 10,
    cook: 7,
    ingredients: [
      ["Sourdough bread", 2, "count", "Slices"],
      ["Avocado", 1, "count", null],
      ["Eggs", 2, "count", null],
      ["Lemon juice", 15, "ml", null],
      ["Chili flakes", null, null, "A pinch"],
    ],
    steps: [
      "Bring a small saucepan of water to a gentle boil. Lower in the eggs and cook for 7 minutes. Cool briefly under cold water and peel.",
      "Toast the sourdough. Mash the avocado with lemon juice and a pinch of salt.",
      "Spread the avocado on the toast, top with halved eggs, and finish with chili flakes.",
    ],
  },
  {
    slot: 6,
    authorSlot: 2,
    title: "Ginger sesame grain bowl",
    description:
      "Brown rice, steamed broccoli and carrots with a soy, ginger and sesame dressing.",
    photo: "bowl",
    servings: 3,
    prep: 15,
    cook: 20,
    ingredients: [
      ["Brown rice", 240, "g", null],
      ["Broccoli", 300, "g", null],
      ["Carrot", 2, "count", null],
      ["Soy sauce", 30, "ml", null],
      ["Sesame oil", 15, "ml", null],
      ["Ginger", 15, "g", "Finely grated"],
    ],
    steps: [
      "Cook the rice according to the package directions.",
      "Cut the broccoli into florets and slice the carrots. Steam for 5–7 minutes until tender with a little bite.",
      "Whisk the soy sauce, sesame oil, and ginger. Divide the warm rice and vegetables among bowls and spoon over the dressing.",
    ],
  },
  {
    slot: 7,
    authorSlot: 1,
    title: "Basil pesto for the week",
    description:
      "Basil pesto with toasted pine nuts, garlic and Parmesan. Spoon it over pasta or spread it on toast.",
    photo: "pasta",
    servings: 6,
    prep: 10,
    cook: 0,
    ingredients: [
      ["Basil", 60, "g", null],
      ["Olive oil", 120, "ml", null],
      ["Parmesan", 60, "g", null],
      ["Pine nuts", 40, "g", null],
      ["Garlic", 1, "count", "Clove"],
    ],
    steps: [
      "Toast the pine nuts in a dry pan until lightly golden. Leave to cool.",
      "Blend the basil, garlic, pine nuts, and parmesan. Stream in the olive oil until you reach a loose paste. Season to taste.",
    ],
  },
  {
    slot: 8,
    authorSlot: 1,
    isPrivate: true,
    title: "Roasted tomato soup for two",
    description:
      "Small-batch tomato soup for two, made with roasted tomatoes and vegetable stock.",
    photo: "soup",
    servings: 2,
    prep: 10,
    cook: 20,
    ingredients: [
      ["Tomatoes", 450, "g", null],
      ["Vegetable stock", 250, "ml", null],
      ["Salt", null, null, "To taste"],
    ],
    steps: [
      "Roast the tomatoes until tender, then simmer with stock and blend. Taste and adjust before serving.",
    ],
  },
  {
    slot: 9,
    authorSlot: 3,
    title: "Red lentil dal with sizzling cumin",
    description:
      "Red lentils soften into a golden dal while the onions brown in a second pan. Swirl the cumin-scented onions through each bowl just before serving.",
    photo: "red-lentil-dal",
    servings: 4,
    prep: 10,
    cook: 25,
    ingredients: [
      ["Split red lentils", 250, "g", "Rinsed and drained"],
      ["Water", 850, "ml", null],
      ["Ground turmeric", 0.5, "tsp", null],
      ["Ginger", 10, "g", "Finely grated"],
      ["Onion", 1, "count", "Thinly sliced"],
      ["Neutral oil", 20, "ml", null],
      ["Cumin seeds", 1, "tsp", null],
      ["Salt", 0.5, "tsp", null],
      ["Lemon juice", 15, "ml", null],
    ],
    steps: [
      "Put the lentils, water, turmeric and ginger in a saucepan. Bring to a boil, skim off any foam and lower the heat.",
      "Simmer with the lid ajar for 18–22 minutes. Stir near the end, crushing a spoonful of lentils against the side of the pan to thicken the dal.",
      "Meanwhile, heat the oil in a skillet over medium heat. Add the cumin seeds. When they sizzle, add the onion and cook for 10–12 minutes, stirring until golden.",
      "Season the lentils with salt and lemon juice. Spoon into bowls and swirl a little cumin oil and onion into each serving.",
    ],
  },
  {
    slot: 10,
    authorSlot: 4,
    title: "Papaya and banana batido",
    description:
      "Ripe papaya gives this chilled yogurt drink its coral colour. A squeeze of lime balances the banana's sweetness.",
    photo: "papaya-batido",
    servings: 2,
    prep: 5,
    cook: 0,
    ingredients: [
      ["Papaya", 250, "g", "Peeled, seeded flesh"],
      ["Banana", 1, "count", "Ripe and peeled"],
      ["Plain yogurt", 150, "g", null],
      ["Cold milk", 120, "ml", null],
      ["Lime juice", 10, "ml", null],
      ["Ice cubes", 4, "count", null],
    ],
    steps: [
      "Cut the papaya and banana into chunks. Pour the milk into a blender, then add the yogurt, fruit and lime juice.",
      "Blend until smooth. Add the ice and blend again until the drink pours easily and no pieces of ice remain.",
      "Divide between glasses and serve cold.",
    ],
  },
  {
    slot: 11,
    authorSlot: 5,
    title: "Lemon and scallion salmon cakes",
    description:
      "Canned salmon makes a quick lunch with a crisp breadcrumb crust. Chilling the patties briefly helps them keep their shape in the skillet.",
    photo: "salmon-cakes",
    servings: 3,
    prep: 20,
    cook: 10,
    ingredients: [
      ["Canned salmon", 340, "g", "Drained weight"],
      ["Breadcrumbs", 60, "g", "Divided between filling and crust"],
      ["Egg", 1, "count", null],
      ["Scallions", 2, "count", "Thinly sliced"],
      ["Lemon", 1, "count", "Zested and cut into wedges"],
      ["Dijon mustard", 2, "tsp", null],
      ["Neutral oil", 20, "ml", null],
    ],
    steps: [
      "Flake the drained salmon into a bowl. Beat the egg with the mustard and lemon zest, then fold it into the salmon with the scallions and half the breadcrumbs.",
      "Form six even patties about 1.5 cm thick. Press both faces into the remaining crumbs and refrigerate for 10 minutes.",
      "Heat the oil in a wide skillet over medium heat. Fry the cakes for 4–5 minutes per side until crisp and hot through. The centres should reach 71°C.",
      "Serve two cakes per person with the lemon wedges.",
    ],
  },
  {
    slot: 12,
    authorSlot: 6,
    title: "Tomato and egg stir-fry",
    description:
      "Soft folds of scrambled egg catch the juices from ripe tomatoes. Cook the eggs first so they stay tender while the tomatoes break down.",
    photo: "tomato-eggs",
    servings: 2,
    prep: 5,
    cook: 8,
    ingredients: [
      ["Tomatoes", 350, "g", "Cut into small wedges"],
      ["Eggs", 4, "count", null],
      ["Scallions", 2, "count", "Keep sliced whites and greens separate"],
      ["Neutral oil", 15, "ml", null],
      ["Water", 15, "ml", null],
      ["Salt", 0.25, "tsp", null],
    ],
    steps: [
      "Beat the eggs with half the salt. Warm half the oil in a skillet over medium heat. Pour in the eggs and push the set edges towards the centre to make broad curds. Slide the just-set eggs onto a plate.",
      "Add the remaining oil and the scallion whites to the pan. Stir for 30 seconds, then add the tomatoes, water and remaining salt. Cook for 3–4 minutes, crushing a few wedges to release their juices.",
      "Return the eggs to the pan and fold gently until coated in tomato and steaming. Scatter the scallion greens over the top.",
    ],
  },
  {
    slot: 13,
    authorSlot: 7,
    title: "Cheese pupusas with crunchy cabbage slaw",
    description:
      "Warm masa cakes enclose a pocket of melted cheese. Make the lime and vinegar slaw first so the cabbage softens slightly while the pupusas cook.",
    photo: "cheese-pupusas",
    servings: 4,
    prep: 25,
    cook: 20,
    ingredients: [
      ["Green cabbage", 180, "g", "Finely shredded"],
      ["Carrot", 1, "count", "Grated"],
      ["Apple cider vinegar", 30, "ml", null],
      ["Lime juice", 15, "ml", null],
      ["Dried oregano", 0.5, "tsp", null],
      ["Salt", 0.75, "tsp", "Divided"],
      ["Masa harina", 200, "g", "Nixtamalized corn flour"],
      ["Warm water", 290, "ml", "Add gradually"],
      ["Low-moisture mozzarella", 120, "g", "Grated"],
      ["Neutral oil", 10, "ml", "For the pan and hands"],
    ],
    steps: [
      "Toss the cabbage and carrot with the vinegar, lime juice, oregano and one-third of the salt. Squeeze gently with clean hands and set aside.",
      "Combine the masa harina and remaining salt. Work in the warm water gradually until the dough feels soft and holds together. Cover for 5 minutes, then divide into eight balls.",
      "With lightly oiled hands, press a hollow into each ball. Add an eighth of the cheese, close the dough around it and pat into a disc about 1 cm thick. Pinch any cracks closed.",
      "Lightly oil a skillet over medium heat. Cook in two batches for 4–5 minutes per side, until speckled brown and hot in the centre. Top with slaw just before eating.",
    ],
  },
  {
    slot: 14,
    authorSlot: 8,
    title: "Chicken and okra gumbo",
    description:
      "A copper-coloured roux gives the broth a toasted flavour. Sliced okra thickens the pot as the chicken simmers.",
    photo: "chicken-gumbo",
    servings: 4,
    prep: 15,
    cook: 50,
    ingredients: [
      ["Neutral oil", 40, "ml", null],
      ["Plain flour", 35, "g", null],
      ["Onion", 1, "count", "Diced"],
      ["Green bell pepper", 1, "count", "Diced"],
      ["Celery", 2, "count", "Stalks, diced"],
      ["Garlic", 2, "count", "Cloves, chopped"],
      ["Smoked paprika", 1, "tsp", null],
      ["Dried thyme", 1, "tsp", null],
      ["Chicken stock", 850, "ml", null],
      ["Chicken thighs", 450, "g", "Boneless, skinless, cut in bite-sized pieces"],
      ["Okra", 200, "g", "Fresh or frozen, sliced"],
      ["Cooked rice", 500, "g", "Hot, for serving"],
    ],
    steps: [
      "Whisk the oil and flour together in a heavy pot over medium-low heat. Stir constantly, scraping the corners, for 12–15 minutes until the mixture is copper brown and smells toasted.",
      "Add the onion, pepper and celery. Cook for 5 minutes, stirring frequently, then add the garlic, paprika and thyme and stir for 30 seconds.",
      "Slowly pour in the stock, stirring until smooth. Add the chicken and okra. Bring to a simmer and cook gently for 20–25 minutes, until the okra is tender and the chicken reaches 74°C in the centre.",
      "Spoon hot rice into bowls and ladle the gumbo around it.",
    ],
  },
  ...publishedChineseRecipes,
];
