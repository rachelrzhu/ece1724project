"use server";

import { refresh } from "next/cache";
import sharp from "sharp";
import { readSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { avatars } from "@/lib/product/avatar";
import { productImageStore } from "@/lib/product/storage";
import { ImageValidationError, inspectRecipeImage, MAX_IMAGE_BYTES } from "@/lib/storage/image";
import { createImageService, ImageCleanupError } from "@/lib/storage/service";

export async function saveAvatar(data: FormData): Promise<{ image: string | null } | { error: string }> {
  const session = await readSession();
  if (!session) return { error: "Sign in to change your avatar." };
  const choice = data.get("avatar");
  let image: string | null;
  try {
    if (choice === "upload") {
      const file = data.get("photo");
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
        return { error: "Choose a still JPEG, PNG or WebP photo up to 3 MiB." };
      }
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
    await getDatabase().user.update({ where: { id: session.user.id }, data: { image }, select: { id: true } });
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: "Choose a still JPEG, PNG or WebP up to 3 MiB and 16 megapixels." };
    if (error instanceof ImageCleanupError) console.error("Avatar cleanup retry required", { pathname: error.pathname });
    return { error: "Couldn’t save your avatar. Please try again." };
  }
  refresh();
  return { image };
}
