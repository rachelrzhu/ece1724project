export const recipePageSizes = [12, 24, 48, 96] as const;
export type RecipePageSize = (typeof recipePageSizes)[number];
export const defaultRecipePageSize: RecipePageSize = 24;

export function parseRecipePageSize(value: unknown): RecipePageSize {
  return recipePageSizes.find(size => size === value || String(size) === value) ?? defaultRecipePageSize;
}
