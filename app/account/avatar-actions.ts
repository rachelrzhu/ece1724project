"use server";

import { refresh } from "next/cache";
import sharp from "sharp";
import { readSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { avatars } from "@/lib/product/avatar";
import { productImageStore } from "@/lib/product/storage";
import { ImageValidationError, inspectRecipeImage, MAX_IMAGE_BYTES } from "@/lib/storage/image";
import { createImageService, ImageCleanupError } from "@/lib/storage/service";
import { takeLimit } from "@/lib/security/rate-limit";
import { CapacityError } from "@/lib/security/capacity";
import { activityLimitMessage, takeUploadLimit, uploadLimitMessage } from "@/lib/security/action-limits";

export async function saveAvatar(data: FormData, expectedUserId?: string): Promise<{ image: string | null } | { error: string }> {
  const session = await readSession();
  if (!session) return { error: "Sign in to change your avatar." };
  if (expectedUserId !== undefined && session.user.id !== expectedUserId)
    return { error: "Sign in to the account you created to upload its avatar." };
  if (!(data instanceof FormData)) return { error: "Choose an avatar or upload a photo." };
  const choice = data.get("avatar");
  let image: string | null;
  try {
    if (choice === "upload") {
      const file = data.get("photo");
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
        return { error: "Choose a still JPEG, PNG or WebP photo up to 3 MiB." };
      }
      if (!(await takeUploadLimit(session.user.id))) return { error: uploadLimitMessage };
      const source = await inspectRecipeImage(new Uint8Array(await file.arrayBuffer()));
      // Publish a small, oriented thumbnail with camera metadata removed.
      const bytes = await sharp(source.bytes).autoOrient().resize(256, 256).webp().toBuffer();
      const upload = await createImageService({
        database: getDatabase, readSession, storage: productImageStore(),
      }).upload({ name: "avatar.webp", bytes });
      image = `/api/images/${upload.id}`;
    } else if (choice === "initial") {
      image = null;
    } else if (typeof choice === "string" && avatars.some(avatar => avatar.image === choice)) {
      image = choice;
    } else if (choice === session.user.image && typeof choice === "string") {
      return { image: choice };
    } else {
      return { error: "Choose an avatar or upload a photo." };
    }
    if (choice !== "upload" && !(await takeLimit("profile", session.user.id))) return { error: activityLimitMessage };
    await getDatabase().user.update({ where: { id: session.user.id }, data: { image }, select: { id: true } });
  } catch (error) {
    if (error instanceof CapacityError) return { error: error.message };
    if (error instanceof ImageValidationError) return { error: "Choose a still JPEG, PNG or WebP up to 3 MiB and 16 megapixels." };
    if (error instanceof ImageCleanupError) console.error("Avatar cleanup retry required", { pathname: error.pathname });
    return { error: "Couldn’t save your avatar. Please try again." };
  }
  refresh();
  return { image };
}
