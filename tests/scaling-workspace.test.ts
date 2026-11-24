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
    { id: "oats", name: "Oats", quantity: "2", unit: "cups", note: null },
  ],
};

describe("recipe scaling workspace", () => {
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
    store.dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: "0.25" }));
    const prior = store.getState().current;
    store.dispatch(scalingActions.reset());
    expect(selectCanReset(store.getState())).toBe(false);
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 4, factor: 1 });
    store.dispatch(scalingActions.undo());
    expect(store.getState().current).toEqual(prior);
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 2.5, factor: 0.625 });
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
      { id: "flour", name: "Flour", units: ["g", "kg"] },
      { id: "dusting", name: "Flour", units: ["g", "kg"] },
      { id: "second-dough", name: "Flour", units: ["g", "kg"] },
    ]);

    store.dispatch(scalingActions.chooseIngredient("dusting"));
    expect(store.getState().current.availableQuantity).toBe("37.5");
    expect(selectPreview(store.getState())).toMatchObject({ ok: true, servings: 6 });
  });
});
