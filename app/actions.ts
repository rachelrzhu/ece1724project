"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readSession, getAuth } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { recipes } from "@/lib/product/queries";
import { recipeIdSchema, recipeInputSchema } from "@/lib/recipes/schemas";
import { visibleRecipeWhere } from "@/lib/recipes/access";
import { headers } from "next/headers";
import { productImageStore } from "@/lib/product/storage";
import { createImageService } from "@/lib/storage/service";

export async function saveRecipe(id: string | null, input: unknown) {
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: "Check the highlighted recipe details.",
      fields: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  if (!(await readSession()))
    return {
      error: "Sign in to save this recipe.",
    };
  try {
    const result = id
      ? await recipes().update(id, parsed.data)
      : await recipes().create(parsed.data);
    if (!result)
      return {
        error: "You can’t edit this recipe.",
      };
    revalidatePath("/", "layout");
    return { id: result.id };
  } catch {
    return {
      error: "Couldn’t save your recipe. Try again.",
    };
  }
}
export async function deleteRecipe(id: string) {
  if (!z.uuid().safeParse(id).success || !(await readSession()))
    return { error: "Sign in to manage your recipes." };
  try {
    if (!(await recipes().remove(id)))
      return { error: "This recipe is no longer available." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { error: "We couldn’t delete this recipe. Please try again." };
  }
}
export async function setBookmark(id: string, saved: boolean) {
  const session = await readSession();
  if (!session) return { error: "Sign in to save recipes." };
  if (!recipeIdSchema.safeParse(id).success || typeof saved !== "boolean")
    return { error: "Invalid recipe." };
  const db = getDatabase();
  try {
    const accessible = await db.recipe.findFirst({
      where: { id, ...visibleRecipeWhere(session.user.id) },
      select: { id: true },
    });
    if (!accessible) return { error: "This recipe is no longer available." };
    if (saved)
      await db.bookmark.upsert({
        where: { userId_recipeId: { userId: session.user.id, recipeId: id } },
        create: { userId: session.user.id, recipeId: id },
        update: {},
      });
    else
      await db.bookmark.deleteMany({
        where: { userId: session.user.id, recipeId: id },
      });
    revalidatePath("/", "layout");
    return { saved };
  } catch {
    return { error: "Couldn’t update saved recipes. Please try again." };
  }
}
export async function signOut() {
  await getAuth().api.signOut({ headers: await headers() });
  revalidatePath("/", "layout");
}
export async function uploadCover(data: FormData) {
  if (!(await readSession())) return { error: "Sign in to upload a photo." };
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024)
    return { error: "Choose a JPEG, PNG or WebP photo up to 3 MiB." };
  try {
    const result = await createImageService({
      database: getDatabase,
      readSession,
      storage: productImageStore(),
    }).upload({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return { id: result.id };
  } catch {
    return {
      error:
        "Upload failed. Try again with a still JPEG, PNG or WebP (up to 3 MiB and 16 megapixels).",
    };
  }
}
