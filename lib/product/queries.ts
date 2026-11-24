import "server-only";
import { cache } from "react";
import { getDatabase } from "@/lib/db/client";
import { readSession } from "@/lib/auth/server";
import { readDietaryContext } from "@/lib/dietary/server";
import { publicAvatarImage } from "@/lib/product/avatar";
import type { ExploreAllergenFilter } from "@/lib/dietary/policy";
import { visibleRecipeWhere } from "@/lib/recipes/access";
import { getPublishedSource } from "@/lib/recipes/published-sources";
import { createRecipeService } from "@/lib/recipes/service";
import { z } from "zod";
export const recipes = () =>
  createRecipeService({ database: getDatabase, readSession });
const publicCookSelect = { id: true, name: true, username: true } as const;
const cardSelect = {
  id: true,
  title: true,
  description: true,
  baseServings: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
  visibility: true,
  coverFileId: true,
  author: { select: publicCookSelect },
} as const;
export const recipePageSize = 6;

export async function listRecipes({
  query = "",
  page = 1,
  collection = "explore",
  authorId,
  difficulty = "",
  hideDietaryConflicts = false,
  allergenFilter,
}: {
  query?: string;
  page?: number;
  collection?: string;
  authorId?: string;
  difficulty?: string;
  hideDietaryConflicts?: boolean;
  allergenFilter?: ExploreAllergenFilter;
}) {
  const db = getDatabase();
  const [session, dietary, allergenMatches] = await Promise.all([
    readSession(),
    readDietaryContext(),
    allergenFilter?.allergens.length
      ? db.ingredientAllergen.findMany({
          where: { allergen: { in: allergenFilter.allergens } },
          select: { canonicalName: true },
        })
      : [],
  ]);
  const excludedNames = [...new Set([
    ...allergenMatches.map(({ canonicalName }) => canonicalName),
    ...(hideDietaryConflicts ? dietary?.conflictNames ?? [] : []),
  ])];
  const viewer = session?.user.id ?? null;
  const q = query.trim().slice(0, 160);
  const pageNumber = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  // Prisma's PostgreSQL contains filter uses LIKE. Treat text in an ingredient name literally.
  const excludedText = allergenFilter?.ingredient.replace(/[\\%_]/g, "\\$&");
  const where = {
    AND: [
      ...(excludedText
        ? [{ ingredients: { none: { canonicalName: { contains: excludedText, mode: "insensitive" as const } } } }]
        : []),
      ...(excludedNames.length
        ? [{ ingredients: { none: { canonicalName: { in: excludedNames } } } }]
        : []),
      {
        ...(authorId ? { authorId, ...(authorId === viewer ? {} : { visibility: "PUBLIC" as const }) } : collection === "mine"
          ? { authorId: viewer ?? "00000000-0000-4000-8000-000000000000" }
          : collection === "saved"
            ? {
                ...visibleRecipeWhere(viewer),
                bookmarks: {
                  some: {
                    userId: viewer ?? "00000000-0000-4000-8000-000000000000",
                  },
                },
              }
            : { visibility: "PUBLIC" as const }),
      },
      {
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                {
                  ingredients: {
                    some: {
                      canonicalName: {
                        contains: q.toLowerCase(),
                        mode: "insensitive" as const,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      {
        ...(["EASY", "MEDIUM", "HARD"].includes(difficulty)
          ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" }
          : {}),
      },
    ],
  };
  const select = {
    ...cardSelect,
    ingredients: dietary ? {
      orderBy: { position: "asc" as const },
      select: { name: true, canonicalName: true },
    } : false as const,
  };
  function readPage(page: number) {
    return db.recipe.findMany({
      where,
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * recipePageSize,
      take: recipePageSize,
    });
  }
  const [firstPageRows, total] = await Promise.all([
    pageNumber === 1 ? readPage(1) : null,
    db.recipe.count({ where }),
  ]);
  const boundedPage = Math.min(pageNumber, Math.max(1, Math.ceil(total / recipePageSize)));
  const rows = firstPageRows ?? await readPage(boundedPage);
  const saved =
    viewer && rows.length
      ? await db.bookmark.findMany({
          where: {
            userId: viewer,
            recipeId: { in: rows.map((row) => row.id) },
          },
          select: { recipeId: true },
        })
      : [];
  return {
    total,
    page: boundedPage,
    rows: rows.map(({ ingredients, ...recipe }) => {
      const source = getPublishedSource(recipe.id);
      const minutes = recipe.prepMinutes + recipe.cookMinutes;
      return {
        ...recipe,
        source,
        baseServings: recipe.baseServings.toString(),
        durationLabel: source && minutes === 0 ? source.time : `${minutes} min`,
        saved: saved.some((b) => b.recipeId === recipe.id),
        dietary: dietary?.summarize(ingredients) ?? null,
      };
    }),
    signedIn: !!viewer,
    hasDietaryPreferences: Boolean(dietary),
  };
}
export type RecipeCardData = Awaited<
  ReturnType<typeof listRecipes>
>["rows"][number];
export const getPublicCook = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const cook = await getDatabase().user.findUnique({ where: { id }, select: { ...publicCookSelect, image: true } });
  return cook ? { ...cook, image: publicAvatarImage(cook.image) } : null;
});
export type PublicCook = NonNullable<Awaited<ReturnType<typeof getPublicCook>>>;

export const getRecipe = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const recipe = await recipes().getById(id);
  if (!recipe) return null;
  const session = await readSession();
  const [author, bookmark, dietary] = await Promise.all([
    getPublicCook(recipe.authorId),
    session
      ? getDatabase().bookmark.findUnique({
          where: { userId_recipeId: { userId: session.user.id, recipeId: id } },
          select: { recipeId: true },
        })
      : null,
    readDietaryContext(),
  ]);
  return {
    ...recipe,
    source: getPublishedSource(recipe.id),
    ingredients: recipe.ingredients.map(({ id, name, quantity, unit, note }) => ({ id, name, quantity, unit, note })),
    dietary: dietary?.summarize(recipe.ingredients) ?? null,
    author,
    saved: !!bookmark,
    isOwner: session?.user.id === recipe.authorId,
    signedIn: !!session,
  };
});
export type RecipeDetailData = NonNullable<
  Awaited<ReturnType<typeof getRecipe>>
>;
