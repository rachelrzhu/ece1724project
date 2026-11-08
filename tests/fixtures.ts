export const ownerId = "00000000-0000-4000-8000-000000000001";
export const otherUserId = "00000000-0000-4000-8000-000000000002";
export const coverId = "00000000-0000-4000-8000-000000000003";
export const recipeId = "00000000-0000-4000-8000-000000000004";

export function recipeInput() {
  return {
    title: "Simple bread",
    description: "A small everyday loaf.",
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    difficulty: "EASY",
    ingredients: [{ name: "Flour", quantity: 400, unit: "g" }],
    steps: [{ instruction: "Mix and bake." }],
  };
}
