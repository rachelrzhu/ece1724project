"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { readSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { avatars, usernameHint, usernamePattern } from "./profile-options";

const profileInput = z.strictObject({
  name: z.string().trim().min(1, "Enter a display name.").max(120, "Use up to 120 characters for your display name."),
  username: z.string().trim().regex(new RegExp(`^${usernamePattern}$`), usernameHint).toLowerCase(),
  image: z.string().nullable(),
});

export async function saveProfile(input: unknown): Promise<{ name: string; username: string } | { error: string }> {
  const session = await readSession();
  if (!session) return { error: "Sign in to save your profile." };
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.code === "unrecognized_keys" ? "Submit only the profile fields shown." : issue.message };
  }
  const { name, username, image } = parsed.data;
  if (image !== null && image !== session.user.image && !avatars.some((choice) => choice.image === image))
    return { error: "Choose one of the available avatars." };

  try {
    await getDatabase().user.update({
      where: { id: session.user.id },
      data: { name, username, image },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { error: "That username is taken. Choose another." };
    return { error: "Couldn’t save your profile. Please try again." };
  }
  refresh();
  return { name, username };
}
