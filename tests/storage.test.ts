import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { inspectRecipeImage, ImageValidationError, MAX_IMAGE_BYTES } from "@/lib/storage/image";
import { createImageService, ImageAccessError, ImageCleanupError } from "@/lib/storage/service";
import { coverId, ownerId } from "./fixtures";
import { CapacityError, imageCapacity } from "@/lib/security/capacity";

vi.mock("server-only", () => ({}));
const sample = readFileSync("tests/fixtures/storage-sample.png");

function setup(userId: string | null = ownerId) {
  const storedFile = {
    aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { size: null } }),
    create: vi.fn().mockResolvedValue({ id: coverId, name: "sample.png", contentType: "image/png", size: sample.byteLength }),
    deleteMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null),
  };
  const database = vi.fn(() => ({ storedFile, $transaction: (callback: (tx: {storedFile: typeof storedFile}) => unknown) => callback({ storedFile }) }) as unknown as PrismaClient);
  const storage = { put: vi.fn().mockResolvedValue(undefined), read: vi.fn().mockResolvedValue(null), remove: vi.fn().mockResolvedValue(undefined) };
  const service = createImageService({ database, readSession: async () => userId ? { user: { id: userId } } : null, storage });
  return { service, storedFile, database, storage };
}

describe("recipe image content validation", () => {
  it.each(["png", "jpeg", "webp"] as const)("decodes supported %s content", async (format) => {
    const bytes = await sharp(sample).toFormat(format).toBuffer();
    const image = await inspectRecipeImage(bytes);
    expect(image).toMatchObject({ contentType: `image/${format}`, width: 160, height: 96, size: bytes.byteLength });
    expect(image.bytes.equals(bytes)).toBe(true);
  });

  it.each([Buffer.alloc(0), Buffer.alloc(MAX_IMAGE_BYTES + 1)])("rejects empty or oversized images", async (bytes) => {
    await expect(inspectRecipeImage(bytes)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it.each([Buffer.from("not a picture"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), sample.subarray(0, 32)])("rejects unsupported or truncated content", async (bytes) => {
    await expect(inspectRecipeImage(bytes)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects an animated PNG even when the decoder only reports its first frame", async () => {
    const animation = readFileSync("tests/fixtures/two-frame.png");
    await expect(inspectRecipeImage(animation)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects an image above the decoded pixel limit even when compressed below 3 MiB", async () => {
    const bytes = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: "#123456" } }).png().toBuffer();
    expect(bytes.byteLength).toBeLessThan(MAX_IMAGE_BYTES);
    await expect(inspectRecipeImage(bytes)).rejects.toBeInstanceOf(ImageValidationError);
  });
});

describe("private image service", () => {
  it("rejects anonymous upload/read before database or Blob access", async () => {
    const { service, storage, database } = setup(null);
    await expect(service.upload({ name: "sample.png", bytes: sample })).rejects.toBeInstanceOf(ImageAccessError);
    await expect(service.readOwn(coverId)).rejects.toBeInstanceOf(ImageAccessError);
    expect(database).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it("validates the name and image before any storage write", async () => {
    const { service, storage } = setup();
    await expect(service.upload({ name: "../sample.png", bytes: sample })).rejects.toThrow();
    await expect(service.upload({ name: "sample.png", bytes: Buffer.from("not an image") })).rejects.toBeInstanceOf(ImageValidationError);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("uses decoded content type, server-derived owner, and a random path independent of the filename", async () => {
    const { service, storage, storedFile } = setup();
    await service.upload({ name: "misleading.jpg", bytes: sample });
    const [pathname, bytes, contentType] = storage.put.mock.calls[0];
    expect(pathname).toMatch(new RegExp(`^recipe-images/${ownerId}/[a-f0-9-]+\\.png$`));
    expect(bytes.equals(sample)).toBe(true);
    expect(contentType).toBe("image/png");
    expect(storedFile.create.mock.calls[0][0].data).toMatchObject({ ownerId, pathname, contentType: "image/png", size: sample.byteLength });
    expect(storedFile.create.mock.calls[0][0].select).not.toHaveProperty("pathname");
  });

  it("skips the upload if it cannot reserve metadata", async () => {
    const { service, storage, storedFile } = setup();
    storedFile.create.mockRejectedValue(new Error("Database unavailable"));
    await expect(service.upload({ name: "sample.png", bytes: sample })).rejects.toThrow("Database unavailable");
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it.each(["account", "site"] as const)("checks both byte and file limits at %s scope before writing to Blob", async (scope) => {
    for (const [count, bytes] of [[imageCapacity[scope].files, 0], [1, imageCapacity[scope].bytes - sample.byteLength + 1]]) {
      const { service, storedFile, storage } = setup();
      if (scope === "site") storedFile.aggregate.mockResolvedValueOnce({ _count: { _all: 1 }, _sum: { size: 10 } });
      storedFile.aggregate.mockResolvedValueOnce({ _count: { _all: count }, _sum: { size: bytes } });
      await expect(service.upload({ name: "sample.png", bytes: sample })).rejects.toBeInstanceOf(CapacityError);
      expect(storage.put).not.toHaveBeenCalled();
      expect(storedFile.create).not.toHaveBeenCalled();
    }
  });

  it("cleans the unique path and releases its reservation after an ambiguous upload failure", async () => {
    const { service, storage, storedFile } = setup();
    storage.put.mockRejectedValue(new Error("Connection lost"));
    await expect(service.upload({ name: "sample.png", bytes: sample })).rejects.toThrow();
    expect(storage.remove).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    expect(storedFile.deleteMany).toHaveBeenCalledWith({ where: { id: storedFile.create.mock.calls[0][0].data.id, ownerId } });
  });

  it("retains the exact path for retry when compensating cleanup fails", async () => {
    const { service, storage, storedFile } = setup();
    storage.put.mockRejectedValue(new Error("Connection lost"));
    storage.remove.mockRejectedValue(new Error("Storage unavailable"));
    const error = await service.upload({ name: "sample.png", bytes: sample }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ImageCleanupError);
    expect(storedFile.deleteMany).not.toHaveBeenCalled();
    expect((error as ImageCleanupError).pathname).toBe(storage.put.mock.calls[0][0]);
  });

  it("applies owner filtering and avoids Blob access for inaccessible metadata", async () => {
    const { service, storage, storedFile } = setup();
    await expect(service.readOwn(coverId)).resolves.toBeNull();
    expect(storedFile.findFirst.mock.calls[0][0].where).toEqual({ id: coverId, ownerId });
    expect(storage.read).not.toHaveBeenCalled();
  });

  it("returns a readable image without exposing its private storage path", async () => {
    const { service, storage, storedFile } = setup();
    storedFile.findFirst.mockResolvedValue({ name: "sample.png", pathname: "private/test.png", contentType: "image/png", size: sample.byteLength });
    storage.read.mockResolvedValue(new ReadableStream({ start(controller) { controller.enqueue(sample); controller.close(); } }));
    const result = await service.readOwn(coverId);
    expect(result).not.toHaveProperty("pathname");
    expect(result?.contentType).toBe("image/png");
    expect(Buffer.from(await new Response(result!.stream).arrayBuffer()).equals(sample)).toBe(true);
  });
});
