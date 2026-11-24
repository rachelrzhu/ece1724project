import "server-only";
import { cache } from "react";
import { getDatabase } from "@/lib/db/client";
import { readSession } from "@/lib/auth/server";
import { visibleRecipeWhere } from "@/lib/recipes/access";
import { createRecipeService } from "@/lib/recipes/service";
import { z } from "zod";
export const recipes = () =>
  createRecipeService({ database: getDatabase, readSession });
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
  authorId: true,
  author: { select: { name: true } },
  _count: { select: { ingredients: true } },
} as const;
export const recipePageSize = 6;

export async function listRecipes({
  query = "",
  page = 1,
  collection = "explore",
  difficulty = "",
}: {
  query?: string;
  page?: number;
  collection?: string;
  difficulty?: string;
}) {
  const session = await readSession();
  const viewer = session?.user.id ?? null;
  const q = query.trim().slice(0, 160);
  const pageNumber = Number.isFinite(page)
    ? Math.max(1, Math.min(10000, Math.floor(page)))
    : 1;
  const where = {
    AND: [
      {
        ...(collection === "mine"
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
  const db = getDatabase();
  const [initialRows, total] = await Promise.all([
    db.recipe.findMany({
      where,
      select: cardSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pageNumber - 1) * recipePageSize,
      take: recipePageSize,
    }),
    db.recipe.count({ where }),
  ]);
  const boundedPage = Math.min(pageNumber, Math.max(1, Math.ceil(total / recipePageSize)));
  const rows =
    boundedPage === pageNumber
      ? initialRows
      : await db.recipe.findMany({
          where,
          select: cardSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (boundedPage - 1) * recipePageSize,
          take: recipePageSize,
        });
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
    rows: rows.map((r) => ({
      ...r,
      baseServings: r.baseServings.toString(),
      saved: saved.some((b) => b.recipeId === r.id),
    })),
    signedIn: !!viewer,
  };
}
export type RecipeCardData = Awaited<
  ReturnType<typeof listRecipes>
>["rows"][number];
export const getRecipe = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const recipe = await recipes().getById(id);
  if (!recipe) return null;
  const session = await readSession();
  const [author, bookmark] = await Promise.all([
    getDatabase().user.findUnique({
      where: { id: recipe.authorId },
      select: { name: true },
    }),
    session
      ? getDatabase().bookmark.findUnique({
          where: { userId_recipeId: { userId: session.user.id, recipeId: id } },
          select: { recipeId: true },
        })
      : null,
  ]);
  return {
    ...recipe,
    authorName: author?.name ?? "a home cook",
    saved: !!bookmark,
    isOwner: session?.user.id === recipe.authorId,
    signedIn: !!session,
  };
});
export type RecipeDetailData = NonNullable<
  Awaited<ReturnType<typeof getRecipe>>
>;
