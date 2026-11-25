import { readFileSync } from "node:fs";
import sharp from "sharp";
import { beforeEach, expect, it, vi } from "vitest";
import { saveAvatar } from "@/app/account/avatar-actions";
import { publicAvatarImage } from "@/lib/product/avatar";
import { coverId, ownerId } from "./fixtures";

vi.mock("server-only", () => ({}));
const { session, create, update, put, remove } = vi.hoisted(() => ({
  session: vi.fn(), create: vi.fn(), update: vi.fn(), put: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ readSession: session }));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => ({ storedFile: { create }, user: { update } }) }));
vi.mock("@/lib/product/storage", () => ({ productImageStore: () => ({ put, remove }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const sample = readFileSync("tests/fixtures/storage-sample.png");

beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue({ user: { id: ownerId, image: "/images/toast.jpg" } });
  create.mockImplementation(async ({ data }) => ({ id: data.id }));
});

function avatarData(choice: string, photo?: File) {
  const data = new FormData();
  data.set("avatar", choice);
  if (photo) data.set("photo", photo);
  return data;
}

it("shows only supported avatar references from existing profiles", () => {
  for (const image of ["/images/pasta.jpg", `/api/images/${coverId}`, "https://lh3.googleusercontent.com/a/photo=s96-c"]) {
    expect(publicAvatarImage(image)).toBe(image);
  }
  for (const image of ["https://example.test/photo", "//example.test/photo", "/api/images/private", "https://lh3.googleusercontent.com.example.test/photo"]) {
    expect(publicAvatarImage(image)).toBeNull();
  }
});

it("stores a small metadata-free avatar and assigns its URL to the signed-in cook", async () => {
  const original = await sharp(sample).withExif({ IFD0: { Artist: "Private info" } }).jpeg().toBuffer();
  const photo = new File([new Uint8Array(original)], "personal-photo.jpeg", { type: "image/jpeg" });
  const result = await saveAvatar(avatarData("upload", photo));
  const { id } = create.mock.calls[0][0].data;
  expect(put).toHaveBeenCalledExactlyOnceWith(`recipe-images/${ownerId}/${id}.webp`, expect.any(Buffer), "image/webp");
  const thumbnail = await sharp(put.mock.calls[0][1]).metadata();
  expect(thumbnail).toMatchObject({ format: "webp", width: 256, height: 256 });
  expect(thumbnail.exif).toBeUndefined();
  expect(result).toEqual({ image: `/api/images/${id}` });
  expect(update).toHaveBeenCalledExactlyOnceWith({ where: { id: ownerId }, data: result, select: { id: true } });
});

it("rejects unauthenticated, invalid and oversized uploads before writing", async () => {
  session.mockResolvedValueOnce(null);
  expect(await saveAvatar(avatarData("initial"))).toHaveProperty("error");
  expect(await saveAvatar(avatarData("initial"), "different-account")).toHaveProperty("error");
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("<svg/>"), new Uint8Array(3 * 1024 * 1024 + 1)]) {
    const photo = new File([bytes], "avatar.png", { type: "image/png" });
    expect(await saveAvatar(avatarData("upload", photo))).toHaveProperty("error");
  }
  expect(update).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});

it("supports presets and initials and rejects arbitrary image references", async () => {
  expect(await saveAvatar(avatarData("https://example.test/picture.png"))).toHaveProperty("error");
  expect(await saveAvatar(avatarData(`/api/images/${ownerId}`))).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
  expect(await saveAvatar(avatarData("/images/pasta.jpg"))).toEqual({ image: "/images/pasta.jpg" });
  expect(await saveAvatar(avatarData("initial"))).toEqual({ image: null });
});
