import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { visibleRecipeWhere } from "./access";
import { recipeIdSchema, recipeInputSchema } from "./schemas";

// The authentication module must supply a verified server session, never request-body data.
export type SessionReader = () => Promise<{ user: { id: string } } | null>;

export class RecipeAccessError extends Error {
  constructor() {
    super("Sign in to create a recipe.");
    this.name = "RecipeAccessError";
  }
}

export class RecipeCoverError extends Error {
  constructor() {
    super("Choose an available image that belongs to your account.");
    this.name = "RecipeCoverError";
  }
}

const recipeDetailSelect = {
  id: true,
  authorId: true,
  title: true,
  description: true,
  baseServings: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
  visibility: true,
  coverFileId: true,
  ingredients: {
    orderBy: { position: "asc" },
    select: { id: true, name: true, quantity: true, unit: true, note: true },
  },
  steps: {
    orderBy: { position: "asc" },
    select: { id: true, instruction: true },
  },
} satisfies Prisma.RecipeSelect;

export function createRecipeService({
  database,
  readSession,
}: {
  database: () => PrismaClient;
  readSession: SessionReader;
}) {
  return {
    async getById(id: string) {
      const recipeId = recipeIdSchema.parse(id);
      const session = await readSession();
      const viewerId = session ? recipeIdSchema.parse(session.user.id) : null;
      const recipe = await database().recipe.findFirst({
        where: { id: recipeId, ...visibleRecipeWhere(viewerId) },
        select: recipeDetailSelect,
      });
      if (!recipe) return null;

      // Decimal strings preserve stored precision and cross the Server Component boundary.
      return {
        ...recipe,
        baseServings: recipe.baseServings.toString(),
        ingredients: recipe.ingredients.map((ingredient) => ({
          ...ingredient,
          quantity: ingredient.quantity?.toString() ?? null,
        })),
      };
    },

    async create(input: unknown) {
      const session = await readSession();
      if (!session) throw new RecipeAccessError();
      const authorId = recipeIdSchema.parse(session.user.id);
      const recipe = recipeInputSchema.parse(input);

      return database().$transaction(async (transaction) => {
        if (recipe.coverFileId) {
          const cover = await transaction.storedFile.findFirst({
            where: {
              id: recipe.coverFileId,
              ownerId: authorId,
              contentType: { in: ["image/jpeg", "image/png", "image/webp"] },
              size: { gt: 0, lte: 3 * 1024 * 1024 },
              coverOf: { is: null },
            },
            select: { id: true },
          });
          if (!cover) throw new RecipeCoverError();
        }

        return transaction.recipe.create({
          data: {
            authorId,
            title: recipe.title,
            description: recipe.description,
            baseServings: new Prisma.Decimal(recipe.baseServings.toString()),
            prepMinutes: recipe.prepMinutes,
            cookMinutes: recipe.cookMinutes,
            difficulty: recipe.difficulty,
            visibility: recipe.visibility,
            coverFileId: recipe.coverFileId,
            ingredients: {
              create: recipe.ingredients.map((ingredient, position) => ({
                ...ingredient,
                quantity: ingredient.quantity === null ? null : new Prisma.Decimal(ingredient.quantity.toString()),
                canonicalName: ingredient.name.toLowerCase(),
                position,
              })),
            },
            steps: {
              create: recipe.steps.map((step, position) => ({ ...step, position })),
            },
          },
          select: { id: true },
        });
      });
    },
  };
}
