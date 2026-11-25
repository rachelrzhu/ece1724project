"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { allergenChoices, dietaryInputSchema } from "@/lib/dietary/policy";
import { takeLimit } from "@/lib/security/rate-limit";
import { activityLimitMessage } from "@/lib/security/action-limits";

export async function saveDietaryPreferences(input: unknown): Promise<{ ok: true } | { error: string }> {
  const session = await readSession();
  if (!session) return { error: "Sign in to save your dietary preferences." };
  if (!(await takeLimit("profile", session.user.id))) return { error: activityLimitMessage };
  if (input && typeof input === "object" && "allergens" in input &&
      Array.isArray(input.allergens) && input.allergens.length > allergenChoices.length) {
    return { error: "Choose each allergen only once." };
  }
  const parsed = dietaryInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a dietary preference and allergens from the available options." };
  const userId = session.user.id;
  try {
    const settings = getDatabase().dietarySettings;
    if (parsed.data.diet === "NONE" && parsed.data.allergens.length === 0) {
      await settings.deleteMany({ where: { userId } });
    } else {
      await settings.upsert({
        where: { userId },
        create: { userId, ...parsed.data },
        update: parsed.data,
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { error: "Couldn’t save your dietary preferences. Please try again." };
  }
}
