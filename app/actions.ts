"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recipeFieldIssue } from "@/lib/i18n/recipe-validation";
import { readSession, getAuth } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { recipes } from "@/lib/product/queries";
import { MAX_RECIPE_ITEMS, recipeEditSchema, recipeIdSchema, recipeInputSchema } from "@/lib/recipes/schemas";
import { visibleRecipeWhere } from "@/lib/recipes/access";
import { headers } from "next/headers";
import { productImageStore } from "@/lib/product/storage";
import { createImageService, ImageCleanupError } from "@/lib/storage/service";
import { MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { takeLimit } from "@/lib/security/rate-limit";
import { CapacityError } from "@/lib/security/capacity";
import { activityLimitMessage, takeUploadLimit, uploadLimitMessage } from "@/lib/security/action-limits";

type SaveRecipeResult =
  | { id: string; error?: never; fields?: never }
  | { error: string; fields?: ReturnType<typeof recipeFieldIssue>[]; id?: never };

function recipeValidationError(error: z.ZodError) {
  return {
    error: "Check the highlighted recipe details.",
    fields: error.issues.slice(0, 20).map(recipeFieldIssue),
  };
}

export async function saveRecipe(id: string | null, input: unknown): Promise<SaveRecipeResult> {
  const session = await readSession();
  if (!session) return { error: "Sign in to save this recipe." };
  if (id !== null && !recipeIdSchema.safeParse(id).success) return { error: "Invalid recipe." };
  try {
    if (!(await takeLimit("recipe", session.user.id))) return { error: activityLimitMessage };
    // Check lengths before Zod visits each submitted ingredient and step.
    if (input && typeof input === "object" &&
        (("ingredients" in input && Array.isArray(input.ingredients) && input.ingredients.length > MAX_RECIPE_ITEMS) ||
         ("steps" in input && Array.isArray(input.steps) && input.steps.length > MAX_RECIPE_ITEMS))) {
      return { error: `Use up to ${MAX_RECIPE_ITEMS} ingredients and ${MAX_RECIPE_ITEMS} steps per recipe.` };
    }
    const parsed = (id ? recipeEditSchema : recipeInputSchema).safeParse(input);
    if (!parsed.success) return recipeValidationError(parsed.error);
    if (!(await takeLimit("recipeContent", "global"))) return { error: activityLimitMessage };
    const result = id
      ? await recipes().update(id, parsed.data)
      : await recipes().create(parsed.data);
    if (!result)
      return {
        error: "You can’t edit this recipe.",
      };
    revalidatePath("/", "layout");
    return { id: result.id };
  } catch (error) {
    if (error instanceof CapacityError) return { error: error.message };
    if (error instanceof z.ZodError) return recipeValidationError(error);
    return {
      error: "Couldn’t save your recipe. Try again.",
    };
  }
}
export async function copyRecipe(id: string) {
  if (!recipeIdSchema.safeParse(id).success)
    return { error: "This recipe is unavailable." };
  const session = await readSession();
  if (!session) return { error: "Sign in to copy this recipe." };
  try {
    if (!(await takeLimit("recipe", session.user.id)) || !(await takeLimit("recipeContent", "global")))
      return { error: activityLimitMessage };
    const copy = await recipes().copyPublic(id);
    if (!copy) return { error: "This recipe is unavailable." };
    revalidatePath("/", "layout");
    return { id: copy.id };
  } catch (error) {
    if (error instanceof CapacityError) return { error: error.message };
    return { error: "Couldn’t copy this recipe. Please try again." };
  }
}
export async function deleteRecipe(id: string) {
  if (!recipeIdSchema.safeParse(id).success) return { error: "Invalid recipe." };
  const session = await readSession();
  if (!session) return { error: "Sign in to manage your recipes." };
  try {
    if (!(await takeLimit("recipe", session.user.id))) return { error: activityLimitMessage };
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
  try {
    if (!(await takeLimit("social", session.user.id))) return { error: activityLimitMessage };
    const db = getDatabase();
    const accessible = await db.recipe.findFirst({
      where: { id, ...visibleRecipeWhere(session.user.id) },
      select: { id: true },
    });
    if (!accessible) return { error: "This recipe is no longer available." };
    if (saved)
      await db.bookmark.createMany({
        data: { userId: session.user.id, recipeId: id },
        skipDuplicates: true,
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
export async function setRecipeReaction(id: string, liked: boolean | null) {
  const session = await readSession();
  if (!session) return { error: "Sign in to react to recipes." };
  if (!recipeIdSchema.safeParse(id).success || (liked !== null && typeof liked !== "boolean"))
    return { error: "Invalid recipe reaction." };
  const userId = session.user.id;
  try {
    if (!(await takeLimit("social", userId))) return { error: activityLimitMessage };
    const db = getDatabase();
    const accessible = await db.recipe.findFirst({
      where: { id, ...visibleRecipeWhere(userId) },
      select: { id: true },
    });
    if (!accessible) return { error: "This recipe is no longer available." };
    const key = { userId, recipeId: id };
    if (liked === null) {
      await db.recipeReaction.deleteMany({ where: key });
    } else {
      await db.recipeReaction.upsert({
        where: { userId_recipeId: key },
        create: { ...key, liked },
        update: { liked },
      });
    }
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { error: "Couldn’t update your reaction. Please try again." };
  }
}
export async function uploadCover(data: FormData) {
  const session = await readSession();
  if (!session) return { error: "Sign in to upload a photo." };
  const file = data instanceof FormData ? data.get("file") : null;
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES)
    return { error: "Choose a JPEG, PNG or WebP photo up to 3 MiB." };
  try {
    if (!(await takeUploadLimit(session.user.id))) return { error: uploadLimitMessage };
    const result = await createImageService({
      database: getDatabase,
      readSession,
      storage: productImageStore(),
    }).upload({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return { id: result.id };
  } catch (error) {
    if (error instanceof CapacityError) return { error: error.message };
    if (error instanceof ImageCleanupError) {
      console.error("Cover cleanup retry required", { pathname: error.pathname });
    }
    return {
      error:
        "Upload failed. Try again with a still JPEG, PNG or WebP (up to 3 MiB and 16 megapixels).",
    };
  }
}
