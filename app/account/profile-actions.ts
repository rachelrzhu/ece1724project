"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { readSession } from "@/lib/auth/server";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/auth/limits";
import { getDatabase } from "@/lib/db/client";
import { takeLimit } from "@/lib/security/rate-limit";
import { activityLimitMessage } from "@/lib/security/action-limits";
import { activeUsernameCooldown, usernameHint, usernamePattern } from "./profile-options";

const profileInput = z.strictObject({
  name: z.string().trim().min(1, "Enter a display name.")
    .max(MAX_DISPLAY_NAME_LENGTH, `Use up to ${MAX_DISPLAY_NAME_LENGTH} characters for your display name.`),
  username: z.string().trim().normalize("NFKC").toLowerCase()
    .regex(new RegExp(`^${usernamePattern}$`, "u"), usernameHint).optional(),
});

export async function saveProfile(input: unknown): Promise<{ name: string; username: string } | { error: string }> {
  const session = await readSession();
  if (!session) return { error: "Sign in to save your profile." };
  if (!(await takeLimit("profile", session.user.id))) return { error: activityLimitMessage };
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.code === "unrecognized_keys" ? "Submit only the profile fields shown." : issue.message };
  }
  const { name, username } = parsed.data;
  const user = session.user;
  const rename = username !== undefined && username !== user.username;
  if (rename && activeUsernameCooldown(user.usernameChangeAvailableAt))
    return { error: "You can change your username once a month." };
  if (!rename && name === user.name) return { name, username: user.username };

  try {
    const saved = await getDatabase().user.update({
      // If two renames race, only the request seeing the original handle can succeed.
      where: { id: user.id, ...(rename && { username: user.username }) },
      data: { name, ...(rename && { username }) },
      select: { username: true },
    });
    refresh();
    return { name, username: saved.username };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { error: "That username is taken. Choose another." };
    if (rename && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
      return { error: "Your username changed in another request. Reload your profile to see it." };
    return { error: "Couldn’t save your profile. Please try again." };
  }
}
