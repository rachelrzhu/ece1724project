import { refresh } from "next/cache";
import { beforeEach, expect, it, vi } from "vitest";
import { saveProfile } from "@/app/account/profile-actions";
import { Prisma } from "@/generated/prisma/client";
import { ownerId, otherUserId } from "./fixtures";

const { session, update } = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ readSession: session }));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => ({ user: { update } }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const googlePhoto = "https://lh3.googleusercontent.com/profile-photo";
const profile = { name: " Home Cook ", username: "New_Cook", image: googlePhoto };

beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue({ user: { id: ownerId, image: googlePhoto } });
});

it("saves a normalized username with the name and existing Google photo for the signed-in user", async () => {
  expect(await saveProfile(profile)).toEqual({ name: "Home Cook", username: "new_cook" });
  expect(update).toHaveBeenCalledExactlyOnceWith({
    where: { id: ownerId },
    data: { name: "Home Cook", username: "new_cook", image: googlePhoto },
    select: { id: true },
  });
  expect(refresh).toHaveBeenCalledOnce();
});

it("requires a session and rejects a submitted account ID", async () => {
  session.mockResolvedValueOnce(null);
  expect(await saveProfile(profile)).toHaveProperty("error");
  expect(await saveProfile({ ...profile, userId: otherUserId })).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});

it.each(["ab", "x".repeat(33), "first last", "maría", "@cook"])("rejects the invalid username %s", async (username) => {
  expect(await saveProfile({ ...profile, username })).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});

it("reports a conflicting username without saving other fields separately", async () => {
  update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002", clientVersion: Prisma.prismaVersion.client,
  }));
  expect(await saveProfile(profile)).toEqual({ error: "That username is taken. Choose another." });
  expect(update).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
});
