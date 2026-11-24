import { expect, it, vi } from "vitest";
import { setBookmark } from "@/app/actions";
import { otherUserId, recipeId } from "./fixtures";

const { createMany } = vi.hoisted(() => ({ createMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  readSession: async () => ({ user: { id: otherUserId } }),
}));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    recipe: { findFirst: async () => ({ id: recipeId }) },
    bookmark: { createMany },
  }),
}));

it("returns saved for both the first insert and a concurrent duplicate", async () => {
  createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  const results = await Promise.all([setBookmark(recipeId, true), setBookmark(recipeId, true)]);
  expect(results).toEqual([{ saved: true }, { saved: true }]);
  expect(createMany).toHaveBeenCalledTimes(2);
  for (const [input] of createMany.mock.calls) {
    expect(input).toEqual({
      data: { userId: otherUserId, recipeId },
      skipDuplicates: true,
    });
  }
});
