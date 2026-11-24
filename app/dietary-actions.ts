"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { dietaryInputSchema } from "@/lib/dietary/policy";

export async function saveDietaryPreferences(input: unknown): Promise<{ ok: true } | { error: string }> {
  const session = await readSession();
  if (!session) return { error: "Sign in to save your dietary preferences." };
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
