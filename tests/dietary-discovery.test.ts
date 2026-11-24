import { beforeEach, expect, it, vi } from "vitest";
import { listRecipes, recipePageSize } from "@/lib/product/queries";
import { otherUserId } from "./fixtures";

const mocks = vi.hoisted(() => ({
  context: vi.fn(), findMany: vi.fn(), count: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ readSession: async () => ({ user: { id: otherUserId } }) }));
vi.mock("@/lib/dietary/server", () => ({ readDietaryContext: mocks.context }));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({ recipe: { findMany: mocks.findMany, count: mocks.count } }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(1);
  mocks.context.mockResolvedValue({ conflictNames: ["milk"], summarize: vi.fn() });
});

it("applies recorded conflicts, visibility and search to both the count and each page", async () => {
  const result = await listRecipes({ query: "rice", hideDietaryConflicts: true, page: 2 });
  expect(result.page).toBe(1);
  const { where } = mocks.count.mock.calls[0][0];
  expect(where.AND).toEqual(expect.arrayContaining([
    { visibility: "PUBLIC" },
    { ingredients: { none: { canonicalName: { in: ["milk"] } } } },
    expect.objectContaining({ OR: expect.any(Array) }),
  ]));
  expect(mocks.findMany.mock.calls.map(([query]) => query.skip)).toEqual([recipePageSize, 0]);
  for (const [pageQuery] of mocks.findMany.mock.calls) {
    expect(pageQuery.where).toEqual(where);
    expect(pageQuery.take).toBe(recipePageSize);
  }
});

it("keeps recipes visible when the cook has not opted into filtering", async () => {
  await listRecipes({});
  expect(mocks.count.mock.calls[0][0].where.AND).not.toContainEqual(
    expect.objectContaining({ ingredients: expect.anything() }),
  );
});
