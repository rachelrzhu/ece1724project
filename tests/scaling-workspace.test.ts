import { describe, expect, it } from "vitest";
import {
  makeScalingStore, scalingActions, selectCanReset, selectEligibleIngredients, selectPreview,
} from "@/lib/recipes/scaling-workspace";
import type { ScalingRecipe } from "@/lib/recipes/scaling";

const recipe: ScalingRecipe = {
  baseServings: "4",
  ingredients: [
    { id: "flour", name: "Flour", quantity: "400", unit: "g", note: null },
    { id: "water", name: "Water", quantity: "200", unit: "mL", note: null },
    { id: "egg", name: "Egg", quantity: "1", unit: "count", note: null },
    { id: "salt", name: "Salt", quantity: null, unit: null, note: "to taste" },
    { id: "oats", name: "Oats", quantity: "2", unit: "scoop", note: null },
  ],
};

describe("recipe scaling workspace", () => {
  it("translates the preview, warnings and pantry options without changing the batch or undo history", () => {
    const egg = { ...recipe.ingredients[2], name: "雞蛋", translations: { en: "Egg", zh: "鸡蛋", fr: "Œuf" } };
    const store = makeScalingStore({ baseServings: 4, ingredients: [egg, recipe.ingredients[4]] });
    store.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "6" }));
    store.dispatch(scalingActions.changeMode("ingredient"));
    const { current, history } = store.getState();

    for (const [language, name] of [["fr", "Œuf"], ["en", "Egg"], ["zh", "鸡蛋"], ["original", "雞蛋"]] as const) {
      store.dispatch(scalingActions.changeLanguage(language));
      expect(store.getState().current).toEqual(current);
      expect(store.getState().history).toEqual(history);
      expect(selectPreview(store.getState())).toMatchObject({
        ok: true, servings: 6,
        ingredients: [{ id: "egg", name, scaledQuantity: 1.5 }, { name: "Oats", scaledQuantity: 3 }],
        warnings: [{ message: `${name} scales to a fraction of a whole item.` }, { code: "cooking-conditions" }],
      });
      expect(selectEligibleIngredients(store.getState())).toEqual([{ id: "egg", name, units: ["count"] }]);
    }
  });

  it("scales a French decimal amount and keeps the result when changing the display language", () => {
    const store = makeScalingStore(recipe, "fr", "fr");
    store.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "1,5" }));
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 1.5 });
    store.dispatch(scalingActions.changeMode("ingredient"));
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 1.5, factor: 0.375 });
    store.dispatch(scalingActions.changeLocale("zh"));
    store.dispatch(scalingActions.changeMode("servings"));
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 1.5, factor: 0.375 });
  });

  it("derives all results from the recipe and groups a continuous input edit into one undo", () => {
    const store = makeScalingStore(recipe);
    store.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "" }));
    store.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "6" }));
    const result = selectPreview(store.getState());
    expect(result).toMatchObject({
      ok: true, factor: 1.5, servings: 6,
      ingredients: [
        { id: "flour", quantity: "400", scaledQuantity: 600 },
        { id: "water", scaledQuantity: 300 },
        { id: "egg", scaledQuantity: 1.5 },
        { id: "salt", scaledQuantity: null, note: "to taste" },
        { id: "oats", scaledQuantity: 3 },
      ],
      warnings: [{ code: "fractional-count" }, { code: "cooking-conditions" }],
    });
    expect(store.getState().history).toHaveLength(1);
    store.dispatch(scalingActions.undo());
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 4, factor: 1 });
    expect(store.getState().history).toHaveLength(0);
  });

  it("preserves the current batch while switching modes and compatible units", () => {
    const store = makeScalingStore(recipe);
    store.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "6" }));
    store.dispatch(scalingActions.changeMode("ingredient"));
    expect(store.getState().current).toMatchObject({ mode: "ingredient", ingredientId: "flour", availableQuantity: "600", availableUnit: "g" });
    store.dispatch(scalingActions.chooseUnit("kg"));
    expect(store.getState().current.availableQuantity).toBe("0.6");
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: expect.closeTo(6), factor: expect.closeTo(1.5) });
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "0.2" }));
    store.dispatch(scalingActions.changeMode("servings"));
    expect(store.getState().current.targetServings).toBe("2");
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 2, factor: 0.5 });
    store.dispatch(scalingActions.undo());
    expect(store.getState().current).toMatchObject({ mode: "ingredient", availableQuantity: "0.2", availableUnit: "kg" });
  });

  it("validates typed amounts and preserves exact amounts behind rounded unit and mode controls", () => {
    const store = makeScalingStore(recipe);
    for (const value of ["1.33333", "0", "101", "1e1"]) {
      store.dispatch(scalingActions.editQuantity({ field: "targetServings", value }));
      expect(selectPreview(store.getState())).toMatchObject({ ok: false, error: { field: "targetServings" } });
    }
    store.dispatch(scalingActions.changeMode("ingredient"));
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "177.777" }));
    expect(selectPreview(store.getState())).toMatchObject({ ok: false, error: { field: "availableQuantity" } });
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "177.8" }));
    store.dispatch(scalingActions.chooseUnit("kg"));
    expect(store.getState().current.availableQuantity).toBe("0.2");
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: expect.closeTo(1.778) });
    store.dispatch(scalingActions.changeMode("servings"));
    expect(store.getState().current.targetServings).toBe("1.8");
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: expect.closeTo(1.778) });
  });

  it("updates the amount and unit when the selected ingredient changes", () => {
    const store = makeScalingStore(recipe);
    store.dispatch(scalingActions.changeMode("ingredient"));
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "250" }));
    store.dispatch(scalingActions.chooseIngredient("water"));
    expect(store.getState().current).toMatchObject({ ingredientId: "water", availableQuantity: "125", availableUnit: "mL" });
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 2.5 });
    store.dispatch(scalingActions.chooseUnit("kg"));
    expect(store.getState().current.availableUnit).toBe("mL");
    store.dispatch(scalingActions.undo());
    expect(store.getState().current).toMatchObject({ ingredientId: "flour", availableQuantity: "250", availableUnit: "g" });
  });

  it("surfaces invalid input and restores all controls when undoing a reset", () => {
    const store = makeScalingStore(recipe);
    store.dispatch(scalingActions.changeMode("ingredient"));
    store.dispatch(scalingActions.chooseUnit("kg"));
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "0" }));
    expect(selectPreview(store.getState())).toMatchObject({ ok: false, error: { field: "availableQuantity" } });
    store.dispatch(scalingActions.finishEditing());
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "0.3" }));
    const prior = store.getState().current;
    store.dispatch(scalingActions.reset());
    expect(selectCanReset(store.getState())).toBe(false);
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 4, factor: 1 });
    store.dispatch(scalingActions.undo());
    expect(store.getState().current).toEqual(prior);
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: expect.closeTo(3), factor: expect.closeTo(0.75) });
    store.dispatch(scalingActions.undo());
    expect(store.getState().current.availableQuantity).toBe("0");
  });

  it("excludes unsupported constraints and initializes a separate workspace for each recipe", () => {
    const original = makeScalingStore(recipe);
    expect(selectEligibleIngredients(original.getState()).map(({ id }) => id)).toEqual(["flour", "water", "egg"]);
    original.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "6" }));
    const other = makeScalingStore({ baseServings: "2", ingredients: recipe.ingredients.slice(3) });
    other.dispatch(scalingActions.changeMode("ingredient"));
    expect(other.getState().current).toMatchObject({ mode: "servings", targetServings: "2", ingredientId: "" });
    expect(other.getState().history).toHaveLength(0);
    expect(selectPreview(original.getState())).toMatchObject({ ok: true, servings: 6 });
  });

  it("uses only ingredient names for pantry options and selects duplicate names by row ID", () => {
    const flour = recipe.ingredients[0];
    const store = makeScalingStore({
      ...recipe,
      ingredients: [
        flour,
        { ...flour, id: "dusting", quantity: "25", note: "For dusting" },
        { ...flour, id: "second-dough" },
      ],
    });
    store.dispatch(scalingActions.editQuantity({ field: "targetServings", value: "6" }));
    store.dispatch(scalingActions.changeMode("ingredient"));

    expect(selectEligibleIngredients(store.getState())).toEqual([
      { id: "flour", name: "Flour", units: ["g", "kg", "oz", "lb"] },
      { id: "dusting", name: "Flour", units: ["g", "kg", "oz", "lb"] },
      { id: "second-dough", name: "Flour", units: ["g", "kg", "oz", "lb"] },
    ]);

    store.dispatch(scalingActions.chooseIngredient("dusting"));
    expect(store.getState().current.availableQuantity).toBe("37.5");
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 6 });
  });
});
