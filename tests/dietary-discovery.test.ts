import { beforeEach, expect, it, vi } from "vitest";
import { getPublicCook, listRecipes, recipePageSize } from "@/lib/product/queries";
import { ownerId, otherUserId } from "./fixtures";

const mocks = vi.hoisted(() => ({
  context: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUser: vi.fn(),
  session: vi.fn(), allergenMatches: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ readSession: mocks.session }));
vi.mock("@/lib/dietary/server", () => ({ readDietaryContext: mocks.context }));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    recipe: { findMany: mocks.findMany, count: mocks.count },
    user: { findUnique: mocks.findUser },
    ingredientAllergen: { findMany: mocks.allergenMatches },
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(1);
  mocks.session.mockResolvedValue({ user: { id: otherUserId } });
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
  expect(mocks.allergenMatches).not.toHaveBeenCalled();
  expect(mocks.count.mock.calls[0][0].where.AND).not.toContainEqual(
    expect.objectContaining({ ingredients: expect.anything() }),
  );
});

it.each([false, true])("combines Explore allergens with search and optional saved conflicts (signed in: %s)", async (signedIn) => {
  if (!signedIn) {
    mocks.session.mockResolvedValue(null);
    mocks.context.mockResolvedValue(null);
  }
  mocks.allergenMatches.mockResolvedValue([
    { canonicalName: "soy sauce" }, { canonicalName: "peanuts" },
    { canonicalName: "mixed sauce" }, { canonicalName: "mixed sauce" },
  ]);
  mocks.count.mockResolvedValue(recipePageSize + 1);
  await listRecipes({
    query: "rice", allergenFilter: { allergens: ["SOY", "PEANUT"], ingredient: "100% 花椒" },
    hideDietaryConflicts: signedIn, page: 2,
  });
  expect(mocks.allergenMatches).toHaveBeenCalledWith({
    where: { allergen: { in: ["SOY", "PEANUT"] } }, select: { canonicalName: true },
  });
  const { where } = mocks.count.mock.calls[0][0];
  const names = ["soy sauce", "peanuts", "mixed sauce", ...(signedIn ? ["milk"] : [])];
  expect(where.AND).toEqual(expect.arrayContaining([
    { visibility: "PUBLIC" }, { ingredients: { none: { canonicalName: { in: names } } } },
    { ingredients: { none: { canonicalName: { contains: "100\\% 花椒", mode: "insensitive" } } } },
    expect.objectContaining({ OR: expect.any(Array) }),
  ]));
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: recipePageSize }));
});

it.each([
  [ownerId, { authorId: ownerId, visibility: "PUBLIC" }],
  [otherUserId, { authorId: otherUserId }],
] as const)("scopes profile counts and pages to the author's recipes visible to the viewer (%s)", async (authorId, scope) => {
  mocks.count.mockResolvedValue(recipePageSize + 1);
  const page = await listRecipes({ authorId, query: "flour", page: 2 });
  expect(page.page).toBe(2);
  const { where } = mocks.count.mock.calls[0][0];
  expect(where.AND).toContainEqual(scope);
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
    select: { id: true, name: true, username: true, image: true },
  });
});
