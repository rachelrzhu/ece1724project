import "server-only";
import { cache } from "react";
import { readSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { buildDietaryContext, defaultPreferences, type DietaryPreferences } from "./policy";

export const readDietaryPreferences = cache(async (): Promise<DietaryPreferences | null> => {
  const session = await readSession();
  if (!session) return null;
  const preferences = await getDatabase().dietarySettings.findUnique({
    where: { userId: session.user.id },
    select: { diet: true, allergens: true },
  });
  return preferences ?? defaultPreferences;
});

// Both caches are scoped to the current React server request.
export const readDietaryContext = cache(async () => {
  const preferences = await readDietaryPreferences();
  if (!preferences || (preferences.diet === "NONE" && preferences.allergens.length === 0)) return null;
  const ingredients = await getDatabase().ingredientProfile.findMany({
    where: { OR: [{ classification: { not: "UNKNOWN" } }, { allergens: { some: {} } }] },
    include: { allergens: true },
  });
  return buildDietaryContext(preferences, ingredients);
});
