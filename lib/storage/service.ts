import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { serializableTransaction } from "@/lib/db/serializable";
import { CapacityError, imageCapacity } from "@/lib/security/capacity";
import type { SessionReader } from "@/lib/recipes/service";
import { privateImageStore, type PrivateImageStore } from "./blob";
import { inspectRecipeImage } from "./image";

export class ImageAccessError extends Error {
  constructor() {
    super("Sign in to manage your images.");
    this.name = "ImageAccessError";
  }
}

export class ImageCleanupError extends Error {
  constructor(readonly pathname: string) {
    super("Image upload failed and storage cleanup must be retried.");
    this.name = "ImageCleanupError";
  }
}

const fileNameSchema = z.string().trim().min(1).max(255).refine((name) => !/[\x00-\x1f\x7f/\\]/.test(name), "Use a filename without path separators or control characters.");

export function createImageService({
  database,
  readSession,
  storage = privateImageStore,
}: {
  database: () => PrismaClient;
  readSession: SessionReader;
  storage?: PrivateImageStore;
}) {
  async function ownerId() {
    const session = await readSession();
    if (!session) throw new ImageAccessError();
    return z.uuid().parse(session.user.id);
  }

  return {
    async upload({ name, bytes }: { name: string; bytes: Uint8Array }) {
      const owner = await ownerId();
      const fileName = fileNameSchema.parse(name);
      const image = await inspectRecipeImage(bytes);
      const id = randomUUID();
      const pathname = `recipe-images/${owner}/${id}.${image.extension}`;
      const db = database();
      // Reserving the metadata first counts pending uploads across instances. The
      // serializable transaction finishes before the external storage request.
      const file = await serializableTransaction(db, async (transaction) => {
        for (const scope of ["account", "site"] as const) {
          const usage = await transaction.storedFile.aggregate({
            where: scope === "account" ? { ownerId: owner } : {},
            _count: { _all: true }, _sum: { size: true },
          });
          const limit = imageCapacity[scope];
          if (usage._count._all >= limit.files || (usage._sum.size ?? 0) + image.size > limit.bytes)
            throw new CapacityError(scope === "account"
              ? "Your account has reached its image storage limit."
              : "Image storage is full. You can still save recipes without a new photo.");
        }
        return transaction.storedFile.create({
          data: { id, ownerId: owner, name: fileName, pathname, contentType: image.contentType, size: image.size },
          select: { id: true, name: true, contentType: true, size: true },
        });
      });
      try {
        await storage.put(pathname, image.bytes, image.contentType);
        return file;
      } catch {
        // The random path belongs only to this attempt, including an ambiguous upload failure.
        try {
          await storage.remove(pathname);
          await db.storedFile.deleteMany({ where: { id, ownerId: owner } });
        } catch {
          throw new ImageCleanupError(pathname);
        }
        throw new Error("Could not save the image. Please try again.");
      }
    },

    async readOwn(id: string) {
      const owner = await ownerId();
      const file = await database().storedFile.findFirst({
        where: { id: z.uuid().parse(id), ownerId: owner },
        select: { name: true, pathname: true, contentType: true, size: true },
      });
      if (!file) return null;
      const stream = await storage.read(file.pathname);
      return stream ? { name: file.name, contentType: file.contentType, size: file.size, stream } : null;
    },
  };
}
