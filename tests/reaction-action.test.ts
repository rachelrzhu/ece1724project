import { beforeEach, expect, it, vi } from "vitest";
import { setRecipeReaction } from "@/app/actions";
import { otherUserId, recipeId } from "./fixtures";

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ takeLimit: async () => true }));
vi.mock("@/lib/auth/server", () => ({ readSession: mocks.readSession }));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    recipe: { findFirst: mocks.findFirst },
    recipeReaction: { upsert: mocks.upsert, deleteMany: mocks.deleteMany },
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readSession.mockResolvedValue({ user: { id: otherUserId } });
  mocks.findFirst.mockResolvedValue({ id: recipeId });
});

it("writes the desired reaction under a single account and recipe key", async () => {
  const key = { userId: otherUserId, recipeId };
  for (const liked of [true, true, false]) {
    expect(await setRecipeReaction(recipeId, liked)).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenLastCalledWith({
      where: { userId_recipeId: key }, create: { ...key, liked }, update: { liked },
    });
  }
  expect(await setRecipeReaction(recipeId, null)).toEqual({ success: true });
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: key });
});

it("requires a signed-in viewer and an accessible recipe before changing a reaction", async () => {
  mocks.readSession.mockResolvedValueOnce(null);
  expect(await setRecipeReaction(recipeId, true)).toHaveProperty("error");
  expect(mocks.findFirst).not.toHaveBeenCalled();
  mocks.findFirst.mockResolvedValue(null);
  for (const liked of [false, null]) expect(await setRecipeReaction(recipeId, liked)).toHaveProperty("error");
  expect(mocks.findFirst).toHaveBeenCalledWith({
    where: { id: recipeId, OR: [{ visibility: "PUBLIC" }, { authorId: otherUserId }] },
    select: { id: true },
  });
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.deleteMany).not.toHaveBeenCalled();
});
