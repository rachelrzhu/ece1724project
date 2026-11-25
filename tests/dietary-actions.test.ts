import { beforeEach, expect, it, vi } from "vitest";
import { saveDietaryPreferences } from "@/app/dietary-actions";
import { readDietaryPreferences } from "@/lib/dietary/server";
import { ownerId, otherUserId } from "./fixtures";

const { session, findUnique, upsert, deleteMany } = vi.hoisted(() => ({
  session: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/rate-limit", () => ({ takeLimit: async () => true }));
vi.mock("@/lib/auth/server", () => ({ readSession: session }));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({ dietarySettings: { findUnique, upsert, deleteMany } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue({ user: { id: ownerId } });
});

it("keeps anonymous reads and writes out of the preference table", async () => {
  session.mockResolvedValue(null);
  expect(await readDietaryPreferences()).toBeNull();
  expect(await saveDietaryPreferences({ diet: "VEGAN", allergens: ["MILK"] })).toHaveProperty("error");
  expect(findUnique).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

it("reads and updates only the current account and rejects user ID injection", async () => {
  const selection = { diet: "VEGETARIAN", allergens: ["PEANUT"] };
  findUnique.mockResolvedValue(selection);
  expect(await readDietaryPreferences()).toEqual(selection);
  expect(findUnique).toHaveBeenCalledWith({
    where: { userId: ownerId }, select: { diet: true, allergens: true },
  });
  expect(await saveDietaryPreferences({ ...selection, userId: otherUserId })).toHaveProperty("error");
  expect(upsert).not.toHaveBeenCalled();
  expect(await saveDietaryPreferences(selection)).toEqual({ ok: true });
  expect(upsert).toHaveBeenCalledWith({
    where: { userId: ownerId }, create: { userId: ownerId, ...selection }, update: selection,
  });
});

it("removes an account’s stored selections when cleared", async () => {
  expect(await saveDietaryPreferences({ diet: "NONE", allergens: [] })).toEqual({ ok: true });
  expect(deleteMany).toHaveBeenCalledWith({ where: { userId: ownerId } });
  findUnique.mockResolvedValue(null);
  expect(await readDietaryPreferences()).toEqual({ diet: "NONE", allergens: [] });
});
