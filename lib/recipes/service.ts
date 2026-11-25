import "server-only";
import { z } from "zod";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { visibleRecipeWhere } from "./access";
import { recipeEditSchema, recipeIdSchema, recipeInputSchema, type RecipeInput } from "./schemas";

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

const recipeContentSelect = {
  title: true,
  description: true,
  baseServings: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
} as const;

const recipeDetailSelect = {
  id: true,
  authorId: true,
  ...recipeContentSelect,
  visibility: true,
  coverFileId: true,
  ingredients: {
    orderBy: { position: "asc" },
    select: { id: true, name: true, canonicalName: true, quantity: true, unit: true, note: true },
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

    async copyPublic(sourceId: string) {
      const authorId = await requireOwner();
      const sourceRecipeId = recipeIdSchema.parse(sourceId);

      // Prisma may read the recipe and its children in separate statements.
      // Read one public snapshot even if the author edits or unpublishes it concurrently.
      return database().$transaction(async (transaction) => {
        const source = await transaction.recipe.findFirst({
          where: { id: sourceRecipeId, visibility: "PUBLIC" },
          select: {
            ...recipeContentSelect,
            ingredients: {
              orderBy: { position: "asc" },
              select: { position: true, name: true, canonicalName: true, quantity: true, unit: true, note: true },
            },
            steps: {
              orderBy: { position: "asc" },
              select: { position: true, instruction: true },
            },
          },
        });
        if (!source) return null;
        const { ingredients, steps, ...content } = source;
        return transaction.recipe.create({
          data: {
            ...content,
            authorId,
            sourceRecipeId,
            visibility: "PRIVATE",
            coverFileId: null,
            ingredients: { create: ingredients },
            steps: { create: steps },
          },
          select: { id: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    },

    async update(id: string, input: unknown) {
      const authorId = await requireOwner();
      const recipeId = recipeIdSchema.parse(id);
      const recipe = recipeEditSchema.parse(input);
      return database().$transaction(async (transaction) => {
        const retainedIds = recipe.ingredients.flatMap(({ quantity }) =>
          quantity && typeof quantity === "object" ? [quantity.fromIngredientId] : []);
        const owned = await transaction.recipe.findFirst({
          where: { id: recipeId, authorId },
          select: { baseServings: true, ingredients: retainedIds.length > 0 && {
            where: { id: { in: retainedIds } }, select: { id: true, unit: true, quantity: true },
          } },
        });
        if (!owned) return null;
        await checkCover(transaction, recipe.coverFileId, authorId, recipeId);
        const data = recipeWriteData({
          ...recipe,
          baseServings: recipe.baseServings === "original" ? Number(owned.baseServings) : recipe.baseServings,
          ingredients: recipe.ingredients.map((ingredient, index) => {
            if (ingredient.quantity === null || typeof ingredient.quantity === "number") {
              return { ...ingredient, quantity: ingredient.quantity };
            }
            const { fromIngredientId } = ingredient.quantity;
            const original = owned.ingredients.find(row => row.id === fromIngredientId);
            if (!original || (original.quantity === null && !ingredient.note)) {
              throw new z.ZodError([{ code: "custom", path: ["ingredients", index, "quantity"],
                message: "Check this ingredient’s measurement and note before saving." }]);
            }
            return { ...ingredient, unit: original.unit, quantity: original.quantity === null ? null : Number(original.quantity) };
          }),
        });
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
