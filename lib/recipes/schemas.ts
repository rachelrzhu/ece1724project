import { z } from "zod";

export const recipeIdSchema = z.uuid();
const visibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

const optionalText = (limit: number) => z.string().trim().min(1).max(limit).nullable().default(null);
const quantitySchema = z.number().finite().positive().max(1_000_000).multipleOf(0.000001);

const ingredientInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  quantity: quantitySchema.nullable(),
  unit: optionalText(32),
  note: optionalText(300),
}).superRefine((ingredient, context) => {
  if (ingredient.quantity !== null && !ingredient.unit) {
    context.addIssue({ code: "custom", path: ["unit"], message: "Specify a unit for a measured ingredient; use count for whole items." });
  }
  if (ingredient.quantity === null && !ingredient.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Describe an unmeasured ingredient, for example: to taste." });
  }
});

export const recipeInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  baseServings: z.number().finite().positive().max(10_000).multipleOf(0.0001),
  prepMinutes: z.number().int().min(0).max(10_080),
  cookMinutes: z.number().int().min(0).max(10_080),
  difficulty: difficultySchema,
  visibility: visibilitySchema.default("PRIVATE"),
  coverFileId: recipeIdSchema.nullable().default(null),
  ingredients: z.array(ingredientInputSchema).min(1).max(100),
  steps: z.array(z.strictObject({ instruction: z.string().trim().min(1).max(4000) })).min(1).max(100),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;
