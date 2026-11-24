import { assert, describe, expect, it } from "vitest";
import { formatScaledQuantity, getScalingUnits, scaleRecipe } from "@/lib/recipes/scaling";

const flour = { id: "flour", name: "Flour", quantity: "400", unit: "g", note: "Sifted" };
const eggs = { id: "eggs", name: "Eggs", quantity: "3", unit: "count", note: null };
const salt = { id: "salt", name: "Salt", quantity: null, unit: null, note: "To taste" };
const recipe = { baseServings: "4", ingredients: [flour, eggs, salt] };

function byIngredient(ingredientId: string, availableQuantity: string | number, availableUnit: string) {
  return { mode: "ingredient" as const, ingredientId, availableQuantity, availableUnit };
}

describe("recipe scaling", () => {
  it("scales the ordered recipe detail from four servings to six", () => {
    const result = scaleRecipe(recipe, { mode: "servings", targetServings: "6" });
    assert(result.ok);
    expect(result.factor).toBe(1.5);
    expect(result.servings).toBe(6);
    expect(result.ingredients).toEqual([
      { ...flour, scaledQuantity: 600 },
      { ...eggs, scaledQuantity: 4.5 },
      { ...salt, scaledQuantity: null },
    ]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "fractional-count", ingredientId: eggs.id }),
      expect.objectContaining({ code: "cooking-conditions" }),
    ]));
  });

  it("converts 0.2 kg of available flour to two servings and 1.5 eggs", () => {
    const result = scaleRecipe(recipe, byIngredient(flour.id, "0.2", "kg"));
    assert(result.ok);
    expect(result.factor).toBe(0.5);
    expect(result.servings).toBe(2);
    expect(result.ingredients.map((item) => item.scaledQuantity)).toEqual([200, 1.5, null]);
  });

  it("selects the ingredient by row ID and retains precision through repeated previews and reset", () => {
    const original = {
      baseServings: "4",
      ingredients: [flour, { ...flour, id: "filling", quantity: "450" }],
    };
    const snapshot = structuredClone(original);
    const result = scaleRecipe(original, byIngredient("filling", 250, "g"));
    assert(result.ok);
    expect(result.factor).toBeCloseTo(250 / 450, 14);
    expect(result.ingredients[0].scaledQuantity).toBeCloseTo(400 * 250 / 450, 12);
    expect(result.servings).toBeCloseTo(4 * 250 / 450, 14);
    const reset = scaleRecipe(original, { mode: "servings", targetServings: 4 });
    assert(reset.ok);
    expect(reset.ingredients.map((row) => row.scaledQuantity)).toEqual([400, 450]);
    expect(original).toEqual(snapshot);
  });

  it.each([
    { unit: "kg", quantity: "0.5", availableQuantity: 250, availableUnit: "g", expected: 0.5 },
    { unit: "ml", quantity: "250", availableQuantity: 1, availableUnit: "L", expected: 4 },
    { unit: "tsp", quantity: "6", availableQuantity: 1, availableUnit: "tbsp", expected: 0.5 },
    { unit: "TBSP", quantity: "1", availableQuantity: 15, availableUnit: "mL", expected: 1 },
    { unit: "count", quantity: "4", availableQuantity: 3, availableUnit: "count", expected: 0.75 },
  ])("converts $availableUnit to the original $unit", (example) => {
    const { unit, quantity, availableQuantity, availableUnit, expected } = example;
    const ingredient = { ...flour, unit, quantity };
    const result = scaleRecipe(
      { baseServings: 1, ingredients: [ingredient] },
      byIngredient(ingredient.id, availableQuantity, availableUnit),
    );
    assert(result.ok);
    expect(result.factor).toBe(expected);
    expect(result.ingredients[0].unit).toBe(unit);
  });

  it("lists compatible units for frontend controls and preserves legacy units in serving mode", () => {
    const legacy = { ...flour, quantity: 1, unit: "scoop" };
    expect(getScalingUnits(salt)).toEqual([]);
    expect(getScalingUnits(legacy)).toEqual([]);
    const volumeUnits = getScalingUnits({ ...flour, unit: "ml" });
    expect(volumeUnits).toEqual(expect.arrayContaining(["mL", "L", "tsp", "tbsp"]));
    expect(volumeUnits).not.toContain("g");
    const source = { baseServings: 1, ingredients: [legacy] };
    const scaled = scaleRecipe(source, { mode: "servings", targetServings: 2 });
    assert(scaled.ok);
    expect(scaled.ingredients[0]).toMatchObject({ unit: "scoop", scaledQuantity: 2 });
    expect(scaleRecipe(source, byIngredient(legacy.id, 2, "scoop")).ok).toBe(false);
  });

  it.each([
    [" kilograms ", "kg"],
    ["Litres", "L"],
    ["TABLESPOONS", "tbsp"],
    ["each", "count"],
  ])("defaults a stored %s unit to the canonical dropdown option %s", (unit, symbol) => {
    const ingredient = { ...flour, unit };
    const options = getScalingUnits(ingredient);
    expect(options[0]).toBe(symbol);
    const result = scaleRecipe({ ...recipe, ingredients: [ingredient] }, byIngredient(flour.id, 400, options[0]));
    assert(result.ok);
    expect(result.factor).toBe(1);
  });

  it.each([0, -1, Infinity, NaN, "", "  ", "2cups"])("rejects invalid scaling input %s", (value) => {
    const failure = { ok: false, error: { message: expect.any(String) } };
    expect(scaleRecipe(recipe, { mode: "servings", targetServings: value })).toMatchObject(failure);
    expect(scaleRecipe(recipe, byIngredient(flour.id, value, "g"))).toMatchObject(failure);
  });

  it.each([
    byIngredient("missing", 10, "g"),
    byIngredient(salt.id, 2, "tsp"),
    byIngredient(flour.id, 200, "mL"),
    byIngredient(flour.id, 1, "handful"),
    byIngredient(eggs.id, 1, "g"),
  ])("rejects unavailable ingredients and incompatible units ($ingredientId, $availableUnit)", (request) => {
    expect(scaleRecipe(recipe, request)).toMatchObject({ ok: false, error: { message: expect.any(String) } });
  });

  it("rejects invalid original servings and a zero constraint denominator", () => {
    expect(scaleRecipe({ ...recipe, baseServings: 0 }, { mode: "servings", targetServings: 1 }).ok).toBe(false);
    const invalid = { ...recipe, ingredients: [{ ...flour, quantity: "0" }] };
    expect(scaleRecipe(invalid, byIngredient(flour.id, 2, "g")).ok).toBe(false);
  });

  it("reports input errors to the matching frontend controls", () => {
    expect(scaleRecipe(recipe, { mode: "servings", targetServings: "" })).toMatchObject({
      ok: false, error: { field: "targetServings" },
    });
    expect(scaleRecipe(recipe, byIngredient(flour.id, 2, "mL"))).toMatchObject({
      ok: false, error: { field: "availableUnit", ingredientId: flour.id },
    });
  });

  it("rejects a finite input when a derived quantity overflows", () => {
    const result = scaleRecipe(recipe, { mode: "servings", targetServings: Number.MAX_VALUE });
    expect(result).toMatchObject({ ok: false, error: { field: "quantity", ingredientId: flour.id } });
  });

  it("reports the measured ingredient whose scaled quantity underflows to zero", () => {
    const original = { baseServings: 1, ingredients: [{ ...flour, quantity: "0.000001" }] };
    const result = scaleRecipe(original, { mode: "servings", targetServings: Number.MIN_VALUE });
    expect(result).toMatchObject({ ok: false, error: { field: "quantity", ingredientId: flour.id } });
  });

  it("ignores floating-point noise around a whole count and warns for a tiny positive fraction", () => {
    const whole = scaleRecipe({ baseServings: 0.01, ingredients: [{ ...eggs, quantity: 1 }] }, {
      mode: "servings", targetServings: 0.07,
    });
    assert(whole.ok);
    expect(whole.warnings.map((warning) => warning.code)).not.toContain("fractional-count");
    const tiny = scaleRecipe({ baseServings: 10_000, ingredients: [{ ...eggs, quantity: "0.000001" }] }, {
      mode: "servings", targetServings: 0.0001,
    });
    assert(tiny.ok);
    expect(tiny.warnings).toContainEqual(
      expect.objectContaining({ code: "fractional-count", ingredientId: eggs.id }),
    );
  });

  it("distinguishes roundoff in a large whole count from a representable quarter of a unit", () => {
    const largeWhole = scaleRecipe({ baseServings: 0.1, ingredients: [{ ...eggs, quantity: 300_000 }] }, {
      mode: "servings", targetServings: 5.8,
    });
    assert(largeWhole.ok);
    expect(largeWhole.ingredients[0].scaledQuantity).toBeCloseTo(17_400_000, 6);
    expect(largeWhole.warnings.map((warning) => warning.code)).not.toContain("fractional-count");

    const quarter = 1_000_000_000_000_000.25;
    const largeFraction = scaleRecipe({ baseServings: 1, ingredients: [{ ...eggs, quantity: 1 }] }, {
      mode: "servings", targetServings: quarter,
    });
    assert(largeFraction.ok);
    expect(largeFraction.ingredients[0].scaledQuantity).toBe(quarter);
    expect(largeFraction.warnings).toContainEqual(
      expect.objectContaining({ code: "fractional-count", ingredientId: eggs.id }),
    );
  });

  it("shows at most one decimal place and identifies positive quantities below display precision", () => {
    expect(formatScaledQuantity(1 / 3)).toBe("0.3");
    expect(formatScaledQuantity(0.000001234567)).toBe("<0.1");
    expect(formatScaledQuantity(0.05)).toBe("0.1");
    expect(formatScaledQuantity(1234.56)).toBe("1234.6");
    expect(formatScaledQuantity(125)).toBe("125");
  });
});
