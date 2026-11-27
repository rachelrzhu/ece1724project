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
  Pescatarian: ["鱼素", "Pescétarien"],
  "Gluten-free": ["无麸质", "Sans gluten"],
  "Dairy-free": ["无乳制品", "Sans produits laitiers"],
  "Egg-free": ["无蛋", "Sans œufs"],
  "Additional allergens and sensitivities": ["其他过敏原与食物敏感", "Autres allergènes et sensibilités alimentaires"],
  Milk: ["牛奶", "Lait"],
  Eggs: ["鸡蛋", "Œufs"],
  Peanuts: ["花生", "Arachides"],
  "Tree nuts": ["树坚果", "Fruits à coque"],
  Sesame: ["芝麻", "Sésame"],
  Soy: ["大豆", "Soja"],
  "Wheat (including triticale)": ["小麦（含小黑麦）", "Blé (y compris le triticale)"],
  Fish: ["鱼类", "Poisson"],
  "Shellfish (crustaceans and molluscs)": ["甲壳类和软体动物", "Fruits de mer (crustacés et mollusques)"],
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
