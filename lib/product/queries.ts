import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import type { RecipeDifficulty } from "@/generated/prisma/enums";
import { getDatabase } from "@/lib/db/client";
import { readSession } from "@/lib/auth/server";
import { readDietaryContext } from "@/lib/dietary/server";
import { publicAvatarImage } from "@/lib/product/avatar";
import type { ExploreAllergenFilter } from "@/lib/dietary/policy";
import { visibleRecipeWhere } from "@/lib/recipes/access";
import { getPublishedSource, publishedRecipeIdsReadyWithin } from "@/lib/recipes/published-sources";
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

export type RecipeSort = "recent" | "likes" | "saved";
export type ReactionSummary = { likes: number; dislikes: number; viewerLikes: boolean | null };
const noReactions: ReactionSummary = { likes: 0, dislikes: 0, viewerLikes: null };

async function readReactions(recipeIds: string[], viewer: string | null) {
  const summaries = new Map<string, ReactionSummary>();
  if (!recipeIds.length) return summaries;
  const rows = await getDatabase().$queryRaw<(ReactionSummary & { id: string })[]>`
    SELECT recipe_id AS id,
           COUNT(*) FILTER (WHERE liked)::int AS likes,
           COUNT(*) FILTER (WHERE NOT liked)::int AS dislikes,
           BOOL_OR(liked) FILTER (WHERE user_id = ${viewer}::uuid) AS "viewerLikes"
    FROM recipe_reactions
    WHERE recipe_id IN (${Prisma.join(recipeIds.map(id => Prisma.sql`${id}::uuid`))})
    GROUP BY recipe_id
  `;
  for (const { id, ...summary } of rows) summaries.set(id, summary);
  return summaries;
}

// Resolve the search and exclusion fields with the same vocabulary used by the write trigger.
const matchingIngredientNames = cache(async (text: string) => {
  if (!text) return [];
  const rows = await getDatabase().$queryRaw<{ canonical_name: string }[]>`
    SELECT canonical_name FROM matching_ingredient_names(${text})
  `;
  return rows.map(({ canonical_name }) => canonical_name);
});

export async function listRecipes({
  query = "",
  page = 1,
  collection = "explore",
  authorId,
  difficulty,
  sort = "recent",
  maxMinutes,
  hideDietaryConflicts = false,
  allergenFilter,
}: {
  query?: string;
  page?: number;
  collection?: string;
  authorId?: string;
  difficulty?: RecipeDifficulty;
  sort?: RecipeSort;
  maxMinutes?: number;
  hideDietaryConflicts?: boolean;
  allergenFilter?: ExploreAllergenFilter;
}) {
  const db = getDatabase();
  const q = query.trim().slice(0, 160);
  const excludedText = allergenFilter?.ingredient.trim().slice(0, 160) ?? "";
  const [session, dietary, matchingNames, excludedTextNames, allergenMatches] = await Promise.all([
    readSession(),
    readDietaryContext(),
    matchingIngredientNames(q),
    matchingIngredientNames(excludedText),
    allergenFilter?.allergens.length
      ? db.ingredientAllergen.findMany({
          where: { allergen: { in: allergenFilter.allergens } },
          select: { canonicalName: true },
        })
      : [],
  ]);
  const excludedNames = [...new Set([
    ...excludedTextNames,
    ...allergenMatches.map(({ canonicalName }) => canonicalName),
    ...(hideDietaryConflicts ? dietary?.conflictNames ?? [] : []),
  ])];
  const viewer = session?.user.id ?? null;
  const pageNumber = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const where = {
    AND: [
      ...(maxMinutes === undefined ? [] : [{
        OR: [
          { totalMinutes: { lte: maxMinutes } },
          { totalMinutes: null, id: { in: publishedRecipeIdsReadyWithin(maxMinutes) } },
        ],
      }]),
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
                { title: { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } },
                { ingredients: { some: { canonicalName: { in: matchingNames } } } },
              ],
            }
          : {}),
      },
      ...(difficulty ? [{ difficulty }] : []),
    ],
  };
  const select = {
    ...cardSelect,
    ingredients: dietary ? {
      orderBy: { position: "asc" as const },
      select: { name: true, canonicalName: true },
    } : false as const,
  };
  const orderBy: Prisma.RecipeOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];
  if (sort === "likes") orderBy.unshift({ likes: { _count: "desc" } });
  if (sort === "saved") orderBy.unshift({ bookmarks: { _count: "desc" } });
  function readPage(page: number) {
    return db.recipe.findMany({
      where,
      select,
      orderBy,
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
  const recipeIds = rows.map(row => row.id);
  const [reactions, saved] = await Promise.all([
    readReactions(recipeIds, viewer),
    viewer && rows.length
      ? db.bookmark.findMany({
          where: {
            userId: viewer,
            recipeId: { in: recipeIds },
          },
          select: { recipeId: true },
        })
      : [],
  ]);
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
        durationLabel: minutes > 0 ? `${minutes} min` : source?.time ?? null,
        saved: saved.some((b) => b.recipeId === recipe.id),
        reactions: reactions.get(recipe.id) ?? noReactions,
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
  const [author, bookmark, dietary, reactions, translations] = await Promise.all([
    getPublicCook(recipe.authorId),
    session
      ? getDatabase().bookmark.findUnique({
          where: { userId_recipeId: { userId: session.user.id, recipeId: id } },
          select: { recipeId: true },
        })
      : null,
    readDietaryContext(),
    readReactions([id], session?.user.id ?? null),
    getDatabase().ingredientTranslation.findMany({
      where: { canonicalName: { in: recipe.ingredients.map(({ canonicalName }) => canonicalName) } },
      select: { canonicalName: true, en: true, zh: true, fr: true },
    }),
  ]);
  const labels = new Map(translations.map(({ canonicalName, ...names }) => [canonicalName, names]));
  return {
    ...recipe,
    source: getPublishedSource(recipe.id),
    ingredients: recipe.ingredients.map(({ id, name, canonicalName, quantity, unit, note }) => ({
      id, name, quantity, unit, note, translations: labels.get(canonicalName) ?? null,
    })),
    dietary: dietary?.summarize(recipe.ingredients) ?? null,
    author,
    saved: !!bookmark,
    reactions: reactions.get(recipe.id) ?? noReactions,
    isOwner: session?.user.id === recipe.authorId,
    signedIn: !!session,
  };
});
export type RecipeDetailData = NonNullable<
  Awaited<ReturnType<typeof getRecipe>>
>;
