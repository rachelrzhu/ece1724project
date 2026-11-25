import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyRecipe, deleteRecipe, saveRecipe, setBookmark, setRecipeReaction, uploadCover } from "@/app/actions";
import { saveAvatar } from "@/app/account/avatar-actions";
import { saveProfile } from "@/app/account/profile-actions";
import { saveDietaryPreferences } from "@/app/dietary-actions";
import { ownerId, recipeId, recipeInput } from "./fixtures";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), takeLimit: vi.fn(), database: vi.fn(), recipes: vi.fn(), storage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ readSession: mocks.session }));
vi.mock("@/lib/db/client", () => ({ getDatabase: mocks.database }));
vi.mock("@/lib/product/queries", () => ({ recipes: mocks.recipes }));
vi.mock("@/lib/product/storage", () => ({ productImageStore: mocks.storage }));
vi.mock("@/lib/security/rate-limit", () => ({ takeLimit: mocks.takeLimit }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: ownerId } });
  mocks.takeLimit.mockResolvedValue(true);
});

const avatar = new FormData();
avatar.set("avatar", "initial");

const changes = [
  ["create recipe", "recipe", () => saveRecipe(null, recipeInput())],
  ["update recipe", "recipe", () => saveRecipe(recipeId, recipeInput())],
  ["copy recipe", "recipe", () => copyRecipe(recipeId)],
  ["delete recipe", "recipe", () => deleteRecipe(recipeId)],
  ["bookmark", "social", () => setBookmark(recipeId, true)],
  ["reaction", "social", () => setRecipeReaction(recipeId, true)],
  ["profile", "profile", () => saveProfile({ name: "Cook" })],
  ["preferences", "profile", () => saveDietaryPreferences({ diet: "NONE", allergens: [] })],
  ["avatar preset", "profile", () => saveAvatar(avatar)],
] as const;

it.each(changes)("rejects %s when the verified account's budget is exhausted", async (_name, policy, change) => {
  mocks.takeLimit.mockResolvedValue(false);
  expect(await change()).toEqual({ error: expect.stringMatching(/try again later/i) });
  expect(mocks.takeLimit).toHaveBeenCalledExactlyOnceWith(policy, ownerId);
  expect(mocks.recipes).not.toHaveBeenCalled();
  expect(mocks.database).not.toHaveBeenCalled();
});

it("shares the site recipe content budget across creates, copies and edits while allowing deletion", async () => {
  mocks.takeLimit.mockImplementation(async policy => policy !== "recipeContent");
  for (const change of [() => saveRecipe(null, recipeInput()), () => copyRecipe(recipeId), () => saveRecipe(recipeId, recipeInput())]) {
    expect(await change()).toEqual({ error: expect.stringMatching(/try again later/i) });
    expect(mocks.takeLimit).toHaveBeenLastCalledWith("recipeContent", "global");
  }
  expect(mocks.recipes).not.toHaveBeenCalled();
  mocks.recipes.mockReturnValue({ remove: vi.fn().mockResolvedValue(true) });
  expect(await deleteRecipe(recipeId)).toEqual({ success: true });
  expect(mocks.takeLimit).toHaveBeenLastCalledWith("recipe", ownerId);
});

describe.each(["cover", "avatar"])("%s uploads", kind => {
  it.each(["upload", "uploadGlobal"])("rejects an exhausted %s budget before reading the image", async policy => {
    const form = new FormData();
    const photo = new File(["fixture"], "photo.png", { type: "image/png" });
    const readBytes = vi.spyOn(photo, "arrayBuffer");
    form.set(kind === "cover" ? "file" : "photo", photo);
    form.set("avatar", "upload");
    mocks.takeLimit.mockImplementation(async name => name !== policy);
    const result = kind === "cover" ? await uploadCover(form) : await saveAvatar(form);
    expect(result).toEqual({ error: expect.stringMatching(/limit/i) });
    expect(mocks.takeLimit.mock.calls).toEqual(policy === "upload" ? [["upload", ownerId]]
      : [["upload", ownerId], ["uploadGlobal", "global"]]);
    expect(readBytes).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });
});

it("requires a session and a per-user allowance before reporting recipe field errors", async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect(await saveRecipe(null, {})).toEqual({ error: expect.stringMatching(/sign in/i) });
  expect(mocks.takeLimit).not.toHaveBeenCalled();
  mocks.takeLimit.mockResolvedValueOnce(false);
  expect(await saveRecipe(null, {})).toEqual({ error: expect.stringMatching(/try again later/i) });
});

it("bounds validation work and feedback on oversized or malformed recipes", async () => {
  const tooMany = { ...recipeInput(), steps: Array(101).fill(null) };
  expect(await saveRecipe(null, tooMany)).toEqual({ error: expect.stringContaining("100") });
  const invalid = { ...recipeInput(), steps: Array(50).fill({ instruction: "" }) };
  expect((await saveRecipe(null, invalid)).fields).toHaveLength(20);
  expect(mocks.takeLimit.mock.calls).toEqual([["recipe", ownerId], ["recipe", ownerId]]);
  expect(mocks.recipes).not.toHaveBeenCalled();
});
