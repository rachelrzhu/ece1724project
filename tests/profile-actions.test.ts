import { refresh } from "next/cache";
import { beforeEach, expect, it, vi } from "vitest";
import { saveProfile } from "@/app/account/profile-actions";
import { Prisma } from "@/generated/prisma/client";
import { ownerId, otherUserId } from "./fixtures";

const { session, update } = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ readSession: session }));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => ({ user: { update } }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const user = { id: ownerId, name: "Previous Name", username: "starter", usernameChangeAvailableAt: null };
const profile = { name: " Home Cook ", username: "New_Cook" };

beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue({ user });
  update.mockResolvedValue({ username: "new_cook" });
});

it("saves a normalized username and display name for the signed-in user", async () => {
  expect(await saveProfile(profile)).toEqual({ name: "Home Cook", username: "new_cook" });
  expect(update).toHaveBeenCalledExactlyOnceWith({
    where: { id: ownerId, username: "starter" },
    data: { name: "Home Cook", username: "new_cook" },
    select: { username: true },
  });
  expect(refresh).toHaveBeenCalledOnce();
});

it("rejects an early rename without writing and lets the cook change their display name", async () => {
  session.mockResolvedValue({ user: { ...user, usernameChangeAvailableAt: new Date("2100-01-01") } });
  expect(await saveProfile(profile)).toEqual({ error: "You can change your username once a month." });
  expect(update).not.toHaveBeenCalled();
  update.mockResolvedValueOnce({ username: "starter" });
  const name = "糖醋 Chef 🍲";
  expect(await saveProfile({ name })).toEqual({ name, username: "starter" });
  expect(update).toHaveBeenCalledExactlyOnceWith({
    where: { id: ownerId }, data: { name }, select: { username: true },
  });
});

it("skips an unchanged submission including a differently cased handle", async () => {
  expect(await saveProfile({ name: user.name, username: user.username.toUpperCase() }))
    .toEqual({ name: user.name, username: user.username });
  expect(update).not.toHaveBeenCalled();
});

it("requires a session and rejects a submitted account ID", async () => {
  session.mockResolvedValueOnce(null);
  expect(await saveProfile(profile)).toHaveProperty("error");
  expect(await saveProfile({ ...profile, userId: otherUserId })).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});

it.each(["", "x".repeat(33), "first last", "🐟", "@cook"])("rejects the invalid username %s", async (username) => {
  expect(await saveProfile({ ...profile, username })).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});

it("accepts a single Unicode letter as a handle and normalizes fullwidth letters", async () => {
  for (const [username, expected] of [["李", "李"], ["ＥＶＡ", "eva"]]) {
    update.mockResolvedValueOnce({ username: expected });
    expect(await saveProfile({ ...profile, username })).toMatchObject({ username: expected });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { name: "Home Cook", username: expected } }));
  }
});

it("reports a conflicting username without saving other fields separately", async () => {
  update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002", clientVersion: Prisma.prismaVersion.client,
  }));
  expect(await saveProfile(profile)).toEqual({ error: "That username is taken. Choose another." });
  expect(update).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
});
