import { beforeEach, expect, it, vi } from "vitest";
import { getPublicCook, listRecipes } from "@/lib/product/queries";
import { defaultRecipePageSize } from "@/lib/product/pagination";
import { MAX_READY_MINUTES, parseMaxMinutes } from "@/lib/recipes/ready-in";
import { ownerId, otherUserId } from "./fixtures";

const mocks = vi.hoisted(() => ({
  context: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUser: vi.fn(),
  session: vi.fn(), allergenMatches: vi.fn(), matchingNames: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ readSession: mocks.session }));
vi.mock("@/lib/dietary/server", () => ({ readDietaryContext: mocks.context }));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    $queryRaw: mocks.matchingNames,
    recipe: { findMany: mocks.findMany, count: mocks.count },
    user: { findUnique: mocks.findUser },
    ingredientAllergen: { findMany: mocks.allergenMatches },
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(1);
  mocks.matchingNames.mockResolvedValue([]);
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
    expect(pageQuery.take).toBe(defaultRecipePageSize);
  }
});

it.each([12, 24, 48, 96])("reaches the last page of a large public collection with %i recipes per page", async (pageSize) => {
  mocks.count.mockResolvedValue(60001);
  const result = await listRecipes({ authorId: ownerId, page: Number.MAX_VALUE, pageSize });
  const lastPage = Math.ceil(60001 / pageSize);
  expect(result).toMatchObject({ page: lastPage, pageSize });
  expect(mocks.findMany).toHaveBeenCalledTimes(1);
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: (lastPage - 1) * pageSize, take: pageSize }));
});

it.each([
  [undefined, 24], ["48", 48], [0, 24], ["12abc", 24], [12.5, 24], [10000, 24],
])("queries the first page with the validated size for %s", async (requestedSize, expectedSize) => {
  const result = await listRecipes({ pageSize: requestedSize });
  expect(result.pageSize).toBe(expectedSize);
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: expectedSize }));
});

it.each([
  ["likes", { likes: { _count: "desc" } }],
  ["saved", { bookmarks: { _count: "desc" } }],
] as const)("orders all matching recipes by %s before taking a page", async (sort, firstOrder) => {
  mocks.count.mockResolvedValue(defaultRecipePageSize + 1);
  await listRecipes({ sort, difficulty: "HARD", page: 2 });
  const { where } = mocks.count.mock.calls[0][0];
  expect(where.AND).toContainEqual({ difficulty: "HARD" });
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where, skip: defaultRecipePageSize, take: defaultRecipePageSize,
    orderBy: [firstOrder, { createdAt: "desc" }, { id: "desc" }],
  }));
});

it("keeps recipes visible when the cook has not opted into filtering", async () => {
  await listRecipes({});
  expect(mocks.allergenMatches).not.toHaveBeenCalled();
  expect(mocks.count.mock.calls[0][0].where.AND).not.toContainEqual(
    expect.objectContaining({ ingredients: expect.anything() }),
  );
});

it("accepts whole minutes within the full supported range", () => {
  expect(parseMaxMinutes("1")).toBe(1);
  expect(parseMaxMinutes("030")).toBe(30);
  expect(parseMaxMinutes("30.0")).toBe(30);
  expect(parseMaxMinutes("3e1")).toBe(30);
  expect(parseMaxMinutes(String(MAX_READY_MINUTES))).toBe(MAX_READY_MINUTES);
  for (const invalid of [undefined, "", "0", "-5", "1.5", "1e-2", "0xff", "15min", String(MAX_READY_MINUTES + 1)]) {
    expect(parseMaxMinutes(invalid)).toBeUndefined();
  }
});

it.each([
  [14, []],
  [15, ["20000000-0000-4000-8000-000000000017"]],
])("uses recorded totals and qualifying published estimates before counting and paging (%i min)", async (maxMinutes, ids) => {
  mocks.count.mockResolvedValue(defaultRecipePageSize + 1);
  await listRecipes({ maxMinutes, difficulty: "EASY", hideDietaryConflicts: true, page: 2 });
  const { where } = mocks.count.mock.calls[0][0];
  expect(where.AND).toEqual(expect.arrayContaining([
    { OR: [{ totalMinutes: { lte: maxMinutes } }, { totalMinutes: null, id: { in: ids } }] },
    { visibility: "PUBLIC" }, { difficulty: "EASY" },
    { ingredients: { none: { canonicalName: { in: ["milk"] } } } },
  ]));
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: defaultRecipePageSize }));
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
  mocks.matchingNames.mockImplementation(async (_sql, text) =>
    text === "100% 花椒" ? [{ canonical_name: "custom spice" }] : [{ canonical_name: "rice" }]);
  mocks.count.mockResolvedValue(defaultRecipePageSize + 1);
  await listRecipes({
    query: "rice", allergenFilter: { allergens: ["SOY", "PEANUT"], ingredient: "100% 花椒" },
    hideDietaryConflicts: signedIn, page: 2,
  });
  expect(mocks.allergenMatches).toHaveBeenCalledWith({
    where: { allergen: { in: ["SOY", "PEANUT"] } }, select: { canonicalName: true },
  });
  const { where } = mocks.count.mock.calls[0][0];
  const names = ["custom spice", "soy sauce", "peanuts", "mixed sauce", ...(signedIn ? ["milk"] : [])];
  expect(where.AND).toEqual(expect.arrayContaining([
    { visibility: "PUBLIC" }, { ingredients: { none: { canonicalName: { in: names } } } },
    { OR: [
      { title: { contains: "rice", mode: "insensitive" } },
      { ingredients: { some: { canonicalName: { in: ["rice"] } } } },
    ] },
  ]));
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: defaultRecipePageSize }));
});

it.each([
  [ownerId, { authorId: ownerId, visibility: "PUBLIC" }],
  [otherUserId, { authorId: otherUserId }],
] as const)("scopes profile counts and pages to the author's recipes visible to the viewer (%s)", async (authorId, scope) => {
  mocks.count.mockResolvedValue(defaultRecipePageSize + 1);
  const page = await listRecipes({ authorId, query: "flour", page: 2 });
  expect(page.page).toBe(2);
  const { where } = mocks.count.mock.calls[0][0];
  expect(where.AND).toContainEqual(scope);
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where, skip: defaultRecipePageSize, take: defaultRecipePageSize, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
