import { describe, expect, it } from "vitest";
import { recipeInputSchema } from "@/lib/recipes/schemas";
import { recipeInput } from "./fixtures";

describe("recipe input", () => {
  it("defaults to private and trims text", () => {
    const result = recipeInputSchema.parse({ ...recipeInput(), title: "  Bread  " });
    expect(result.title).toBe("Bread");
    expect(result.visibility).toBe("PRIVATE");
    expect(result.coverFileId).toBeNull();
  });

  it("preserves original fractional quantities", () => {
    const input = recipeInput();
    input.ingredients[0].quantity = 0.000001;
    expect(recipeInputSchema.parse(input).ingredients[0].quantity).toBe(0.000001);
  });

  it.each([0, -1, NaN, Infinity, 0.0000001, 1_000_001])("rejects invalid quantities: %s", (quantity) => {
    expect(recipeInputSchema.safeParse({ ...recipeInput(), ingredients: [{ name: "Flour", quantity, unit: "g" }] }).success).toBe(false);
  });

  it("accepts a documented unmeasured ingredient", () => {
    const parsed = recipeInputSchema.parse({ ...recipeInput(), ingredients: [{ name: "Salt", quantity: null, note: "to taste" }] });
    expect(parsed.ingredients[0].quantity).toBeNull();
  });

  it("rejects an unmeasured ingredient without a note and a measured ingredient without a unit", () => {
    for (const ingredient of [{ name: "Salt", quantity: null }, { name: "Egg", quantity: 1 }]) {
      expect(recipeInputSchema.safeParse({ ...recipeInput(), ingredients: [ingredient] }).success).toBe(false);
    }
  });

  it("rejects client-supplied ownership and positions", () => {
    expect(recipeInputSchema.safeParse({ ...recipeInput(), authorId: "someone-else" }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ ...recipeInput(), ingredients: [{ name: "Egg", quantity: 1, unit: "count", position: 99 }] }).success).toBe(false);
  });

  it("bounds servings, times, text, and child counts", () => {
    for (const change of [
      { title: " " }, { title: "x".repeat(161) }, { baseServings: 0 },
      { baseServings: 0.00001 }, { prepMinutes: -1 }, { cookMinutes: 0.5 },
      { ingredients: [] }, { steps: [] }, { steps: Array(101).fill({ instruction: "Mix" }) },
    ]) {
      expect(recipeInputSchema.safeParse({ ...recipeInput(), ...change }).success).toBe(false);
    }
  });
});
