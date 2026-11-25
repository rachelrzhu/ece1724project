import { z } from "zod";
import { findUnit, MAX_QUANTITY, MAX_SERVINGS, MIN_QUANTITY } from "./measurements";

export const recipeIdSchema = z.uuid();
const visibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

const optionalText = (limit: number) => z.string().trim().min(1).max(limit).nullable().default(null);
const quantitySchema = z.number().min(MIN_QUANTITY).max(MAX_QUANTITY).multipleOf(0.1, "Use at most one decimal place.");
const baseServingsSchema = z.number().int("Use a whole number of servings.").min(1).max(MAX_SERVINGS);
const unitSchema = z.string().trim().max(32).transform((name, ctx) => {
  const unit = findUnit(name);
  if (unit) return unit.symbol;
  ctx.addIssue({ code: "custom", message: "Choose a unit from the menu." });
  return z.NEVER;
});

const ingredientFields = {
  name: z.string().trim().min(1).max(160),
  note: optionalText(300),
};
const ingredientInputSchema = z.strictObject({
  ...ingredientFields,
  quantity: quantitySchema.nullable(),
  unit: unitSchema.nullable().default(null),
}).superRefine((ingredient, context) => {
  if (ingredient.quantity !== null && !ingredient.unit) {
    context.addIssue({ code: "custom", path: ["unit"], message: "Choose a unit for this quantity. Use count for whole items." });
  }
  if (ingredient.quantity === null && !ingredient.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Describe the unmeasured ingredient, such as “to taste”." });
  }
});

export const recipeInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  baseServings: baseServingsSchema,
  prepMinutes: z.number().int().min(0).max(10_080),
  cookMinutes: z.number().int().min(0).max(10_080),
  difficulty: difficultySchema,
  visibility: visibilitySchema.default("PRIVATE"),
  coverFileId: recipeIdSchema.nullable().default(null),
  ingredients: z.array(ingredientInputSchema).min(1).max(100),
  steps: z.array(z.strictObject({ instruction: z.string().trim().min(1).max(4000) })).min(1).max(100),
});

// An edit may keep an existing measurement verbatim. Only the owner's stored row supplies its value.
const storedIngredientSchema = z.strictObject({
  ...ingredientFields,
  quantity: z.strictObject({ fromIngredientId: recipeIdSchema }),
  unit: z.null(),
});
export const recipeEditSchema = recipeInputSchema.extend({
  baseServings: z.union([baseServingsSchema, z.literal("original")]),
  ingredients: z.array(z.union([ingredientInputSchema, storedIngredientSchema])).min(1).max(100),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;
