import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { visibleRecipeWhere } from "./access";
import { recipeIdSchema, recipeInputSchema, type RecipeInput } from "./schemas";

// The authentication module must supply a verified server session, never request-body data.
export type SessionReader = () => Promise<{ user: { id: string } } | null>;

export class RecipeAccessError extends Error {
  constructor() {
    super("Sign in to manage recipes.");
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

function recipeWriteData(recipe: RecipeInput) {
  const { ingredients, steps, ...fields } = recipe;
  return {
    ...fields,
    baseServings: new Prisma.Decimal(recipe.baseServings.toString()),
    ingredients: { create: ingredients.map((ingredient, position) => ({
      ...ingredient,
      quantity: ingredient.quantity === null ? null : new Prisma.Decimal(ingredient.quantity.toString()),
      canonicalName: ingredient.name.toLowerCase(),
      position,
    })) },
    steps: { create: steps.map((step, position) => ({ ...step, position })) },
  };
}

export function createRecipeService({
  database,
  readSession,
}: {
  database: () => PrismaClient;
  readSession: SessionReader;
}) {
  async function requireOwner() {
    const session = await readSession();
    if (!session) throw new RecipeAccessError();
    return recipeIdSchema.parse(session.user.id);
  }

  async function checkCover(transaction: Prisma.TransactionClient, coverId: string | null, authorId: string, recipeId?: string) {
    if (!coverId) return;
    const cover = await transaction.storedFile.findFirst({
      where: {
        id: coverId, ownerId: authorId,
        contentType: { in: ["image/jpeg", "image/png", "image/webp"] },
        size: { gt: 0, lte: 3 * 1024 * 1024 },
        ...(recipeId
          ? { OR: [{ coverOf: { is: null } }, { coverOf: { is: { id: recipeId } } }] }
          : { coverOf: { is: null } }),
      },
      select: { id: true },
    });
    if (!cover) throw new RecipeCoverError();
  }

  return {
    async listOwn() {
      const authorId = await requireOwner();
      const recipes = await database().recipe.findMany({
        where: { authorId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 50,
        select: { id: true, title: true, baseServings: true, coverFileId: true },
      });
      return recipes.map((recipe) => ({ ...recipe, baseServings: recipe.baseServings.toString() }));
    },

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
      const authorId = await requireOwner();
      const recipe = recipeInputSchema.parse(input);

      return database().$transaction(async (transaction) => {
        await checkCover(transaction, recipe.coverFileId, authorId);
        return transaction.recipe.create({
          data: { authorId, ...recipeWriteData(recipe) },
          select: { id: true },
        });
      });
    },

    async update(id: string, input: unknown) {
      const authorId = await requireOwner();
      const recipeId = recipeIdSchema.parse(id);
      const recipe = recipeInputSchema.parse(input);
      return database().$transaction(async (transaction) => {
        const owned = await transaction.recipe.findFirst({ where: { id: recipeId, authorId }, select: { id: true } });
        if (!owned) return null;
        await checkCover(transaction, recipe.coverFileId, authorId, recipeId);
        const data = recipeWriteData(recipe);
        return transaction.recipe.update({
          where: { id: recipeId, authorId },
          data: {
            ...data,
            ingredients: { deleteMany: {}, create: data.ingredients.create },
            steps: { deleteMany: {}, create: data.steps.create },
          },
          select: { id: true },
        });
      });
    },

    async remove(id: string) {
      const authorId = await requireOwner();
      const recipeId = recipeIdSchema.parse(id);
      const result = await database().recipe.deleteMany({ where: { id: recipeId, authorId } });
      return result.count > 0;
    },
  };
}
