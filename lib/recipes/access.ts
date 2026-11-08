import type { Prisma } from "@/generated/prisma/client";

export function visibleRecipeWhere(viewerId: string | null): Prisma.RecipeWhereInput {
  return viewerId
    ? { OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }
    : { visibility: "PUBLIC" };
}
