import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { createRecipeService, RecipeAccessError, RecipeCoverError } from "@/lib/recipes/service";
import { coverId, otherUserId, ownerId, recipeId, recipeInput } from "./fixtures";

vi.mock("server-only", () => ({}));

function setup(userId: string | null = ownerId) {
  const transaction = {
    storedFile: { findFirst: vi.fn().mockResolvedValue(null) },
    recipe: { create: vi.fn().mockResolvedValue({ id: recipeId }) },
  };
  const client = {
    recipe: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback) => callback(transaction)),
  };
  const database = vi.fn(() => client as unknown as PrismaClient);
  const service = createRecipeService({
    database,
    readSession: async () => userId ? { user: { id: userId } } : null,
  });
  return { service, client, transaction, database };
}

describe("recipe service boundaries", () => {
  it("rejects anonymous writes before database access", async () => {
    const { service, database } = setup(null);
    await expect(service.create(recipeInput())).rejects.toBeInstanceOf(RecipeAccessError);
    expect(database).not.toHaveBeenCalled();
  });

  it("rejects owner injection and invalid data before opening a transaction", async () => {
    const { service, client } = setup();
    await expect(service.create({ ...recipeInput(), authorId: otherUserId })).rejects.toThrow();
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("derives ownership from the session and writes ordered children in the same transaction", async () => {
    const { service, client, transaction } = setup();
    await expect(service.create(recipeInput())).resolves.toEqual({ id: recipeId });
    expect(client.$transaction).toHaveBeenCalledOnce();
    const { data } = transaction.recipe.create.mock.calls[0][0];
    expect(data.authorId).toBe(ownerId);
    expect(data.visibility).toBe("PRIVATE");
    expect(data.baseServings.toString()).toBe("4");
    expect(data.ingredients.create[0]).toMatchObject({ position: 0, canonicalName: "flour" });
    expect(data.steps.create[0]).toMatchObject({ position: 0 });
  });

  it("rejects an inaccessible or already attached cover without creating rows", async () => {
    const { service, transaction } = setup();
    await expect(service.create({ ...recipeInput(), coverFileId: coverId })).rejects.toBeInstanceOf(RecipeCoverError);
    expect(transaction.storedFile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: coverId, ownerId, coverOf: { is: null } }),
    }));
    expect(transaction.recipe.create).not.toHaveBeenCalled();
  });

  it("attaches an eligible cover owned by the session user", async () => {
    const { service, transaction } = setup();
    transaction.storedFile.findFirst.mockResolvedValue({ id: coverId });
    await service.create({ ...recipeInput(), coverFileId: coverId });
    expect(transaction.recipe.create.mock.calls[0][0].data.coverFileId).toBe(coverId);
  });

  it("restricts anonymous reads to public recipes in the database query", async () => {
    const { service, client } = setup(null);
    await expect(service.getById(recipeId)).resolves.toBeNull();
    expect(client.recipe.findFirst.mock.calls[0][0].where).toEqual({ id: recipeId, visibility: "PUBLIC" });
  });

  it("allows a signed-in reader only public recipes or their own private recipes", async () => {
    const { service, client } = setup(otherUserId);
    await service.getById(recipeId);
    expect(client.recipe.findFirst.mock.calls[0][0].where).toEqual({
      id: recipeId, OR: [{ visibility: "PUBLIC" }, { authorId: otherUserId }],
    });
  });

  it("serializes decimals without exposing storage paths or account records", async () => {
    const { service, client } = setup();
    client.recipe.findFirst.mockResolvedValue({
      id: recipeId, baseServings: new Prisma.Decimal("4.125"),
      ingredients: [{ id: "flour", quantity: new Prisma.Decimal("0.123456") }, { id: "salt", quantity: null }],
    });
    const result = await service.getById(recipeId);
    expect(result?.baseServings).toBe("4.125");
    expect(result?.ingredients.map((ingredient) => ingredient.quantity)).toEqual(["0.123456", null]);
    const selection = client.recipe.findFirst.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty("cover");
    expect(selection).not.toHaveProperty("author");
  });
});
