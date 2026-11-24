import { beforeEach, expect, it, vi } from "vitest";
import { getPublicCook, listRecipes, recipePageSize } from "@/lib/product/queries";
import { ownerId, otherUserId } from "./fixtures";

const mocks = vi.hoisted(() => ({
  context: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUser: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ readSession: async () => ({ user: { id: otherUserId } }) }));
vi.mock("@/lib/dietary/server", () => ({ readDietaryContext: mocks.context }));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    recipe: { findMany: mocks.findMany, count: mocks.count },
    user: { findUnique: mocks.findUser },
  }),
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
  expect(mocks.findMany.mock.calls.map(([query]) => query.skip)).toEqual([0]);
  for (const [pageQuery] of mocks.findMany.mock.calls) {
    expect(pageQuery.where).toEqual(where);
    expect(pageQuery.take).toBe(recipePageSize);
  }
});

it("can reach the last page of a large public collection with a bounded database offset", async () => {
  mocks.count.mockResolvedValue(60001);
  const result = await listRecipes({ authorId: ownerId, page: Number.MAX_VALUE });
  expect(result.page).toBe(10001);
  expect(mocks.findMany).toHaveBeenCalledTimes(1);
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 60000, take: recipePageSize }));
});

it("keeps recipes visible when the cook has not opted into filtering", async () => {
  await listRecipes({});
  expect(mocks.count.mock.calls[0][0].where.AND).not.toContainEqual(
    expect.objectContaining({ ingredients: expect.anything() }),
  );
});

it.each([ownerId, otherUserId])("limits profile result counts and pages to public recipes by %s, even for the cook viewing their own page", async (authorId) => {
  mocks.count.mockResolvedValue(recipePageSize + 1);
  const page = await listRecipes({ authorId, query: "flour", page: 2 });
  expect(page.page).toBe(2);
  const { where } = mocks.count.mock.calls[0][0];
  expect(where.AND).toContainEqual({ authorId, visibility: "PUBLIC" });
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where, skip: recipePageSize, take: recipePageSize, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }));
});

it("loads only public profile fields and rejects malformed IDs before querying", async () => {
  expect(await getPublicCook("invalid")).toBeNull();
  expect(mocks.findUser).not.toHaveBeenCalled();
  mocks.findUser.mockResolvedValue(null);
  expect(await getPublicCook(ownerId)).toBeNull();
  expect(mocks.findUser).toHaveBeenCalledWith({
    where: { id: ownerId },
    select: { id: true, name: true, username: true },
  });
});
