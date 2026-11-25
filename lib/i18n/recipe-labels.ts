import type { Messages } from "@/lib/i18n";

export const ingredientWarningMessages = {
  "Some ingredients are unrecognized. Please check the ingredient list before cooking.": [
    "有些食材未能识别。请在烹饪前自行核对食材清单。",
    "Certains ingrédients n’ont pas été reconnus. Veuillez vérifier la liste des ingrédients avant de cuisiner.",
  ],
} as const satisfies Messages;

export const dietMessages = {
  "No dietary preference": ["无饮食偏好", "Aucune préférence alimentaire"],
  Vegetarian: ["蛋奶素", "Végétarien"],
  Vegan: ["纯素", "Végétalien"],
  Milk: ["牛奶", "Lait"],
  Eggs: ["鸡蛋", "Œufs"],
  Peanuts: ["花生", "Arachides"],
  "Tree nuts": ["树坚果", "Fruits à coque"],
  Sesame: ["芝麻", "Sésame"],
  Soy: ["大豆", "Soja"],
  "Wheat and triticale": ["小麦和小黑麦", "Blé et triticale"],
  Fish: ["鱼类", "Poisson"],
  "Crustaceans and molluscs": ["甲壳类和软体动物", "Crustacés et mollusques"],
  Mustard: ["芥末", "Moutarde"],
  Sulphites: ["亚硫酸盐", "Sulfites"],
} as const satisfies Messages;

export const difficultyLabels = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;
export const difficultyMessages = {
  Easy: ["简单", "Facile"],
  Medium: ["中等", "Intermédiaire"],
  Hard: ["困难", "Difficile"],
  Public: ["公开", "Publique"],
  Private: ["私密", "Privée"],
} as const satisfies Messages;
