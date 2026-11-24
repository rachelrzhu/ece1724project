import { configureStore, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  convertScalingQuantity,
  getScalingUnits,
  scaleRecipe,
  type ScalingRecipe,
  type ScalingResult,
} from "./scaling";

type Mode = "servings" | "ingredient";
type QuantityField = "targetServings" | "availableQuantity";

type Settings = {
  mode: Mode;
  targetServings: string;
  ingredientId: string;
  availableQuantity: string;
  availableUnit: string;
};

type Workspace = {
  recipe: ScalingRecipe;
  current: Settings;
  history: Settings[];
  editing: QuantityField | null;
};

const historyLimit = 30;

function originalSettings(recipe: ScalingRecipe): Settings {
  const firstMeasured = recipe.ingredients.find((item) => getScalingUnits(item).length > 0);
  return {
    mode: "servings",
    targetServings: String(recipe.baseServings),
    ingredientId: firstMeasured?.id ?? "",
    availableQuantity: String(firstMeasured?.quantity ?? ""),
    availableUnit: firstMeasured ? getScalingUnits(firstMeasured)[0] : "",
  };
}

function initialize(recipe: ScalingRecipe): Workspace {
  return { recipe, current: originalSettings(recipe), history: [], editing: null };
}

function calculate(recipe: ScalingRecipe, settings: Settings): ScalingResult {
  if (settings.mode === "servings") {
    return scaleRecipe(recipe, { mode: "servings", targetServings: settings.targetServings });
  }
  return scaleRecipe(recipe, {
    mode: "ingredient",
    ingredientId: settings.ingredientId,
    availableQuantity: settings.availableQuantity,
    availableUnit: settings.availableUnit,
  });
}

function settingsMatch(current: Settings, next: Settings) {
  return current.mode === next.mode && current.targetServings === next.targetServings
    && current.ingredientId === next.ingredientId && current.availableQuantity === next.availableQuantity
    && current.availableUnit === next.availableUnit;
}

function update(state: Workspace, next: Settings, editing: QuantityField | null = null) {
  const current = state.current;
  if (settingsMatch(current, next)) return;

  // A continuous edit in one input is a single undo step.
  if (!editing || editing !== state.editing) {
    state.history.push(current);
    if (state.history.length > historyLimit) state.history.shift();
  }
  state.current = next;
  state.editing = editing;
}

function validScale(state: Workspace) {
  const current = calculate(state.recipe, state.current);
  return current.ok ? current : calculate(state.recipe, originalSettings(state.recipe));
}

function withIngredient(state: Workspace, itemId: string, preferredUnit: string): Settings | null {
  const result = validScale(state);
  if (!result.ok) return null;
  const item = result.ingredients.find(({ id }) => id === itemId);
  if (!item || item.scaledQuantity === null) return null;
  const units = getScalingUnits(item);
  const unit = units.includes(preferredUnit) ? preferredUnit : units[0];
  if (!unit) return null;
  const amount = convertScalingQuantity(item.scaledQuantity, units[0], unit);
  if (amount === null) return null;
  return {
    ...state.current,
    mode: "ingredient",
    targetServings: String(result.servings),
    ingredientId: item.id,
    availableQuantity: String(amount),
    availableUnit: unit,
  };
}

const scaling = createSlice({
  name: "scaling",
  initialState: initialize({ baseServings: 1, ingredients: [] }),
  reducers: {
    editQuantity(state, action: PayloadAction<{ field: QuantityField; value: string }>) {
      const { field, value } = action.payload;
      update(state, { ...state.current, [field]: value }, field);
    },
    finishEditing(state) {
      state.editing = null;
    },
    changeMode(state, { payload: mode }: PayloadAction<Mode>) {
      const current = state.current;
      if (current.mode === mode) return;

      if (mode === "servings") {
        const result = validScale(state);
        if (result.ok) update(state, { ...current, mode, targetServings: String(result.servings) });
      } else {
        const next = withIngredient(state, current.ingredientId, current.availableUnit);
        if (next) update(state, next);
      }
    },
    chooseIngredient(state, { payload: id }: PayloadAction<string>) {
      if (state.current.mode !== "ingredient" || state.current.ingredientId === id) return;
      const next = withIngredient(state, id, "");
      if (next) update(state, next);
    },
    chooseUnit(state, { payload: unit }: PayloadAction<string>) {
      const current = state.current;
      if (current.mode !== "ingredient" || current.availableUnit === unit) return;
      const item = state.recipe.ingredients.find(({ id }) => id === current.ingredientId);
      if (!item || !getScalingUnits(item).includes(unit)) return;
      const amount = convertScalingQuantity(current.availableQuantity, current.availableUnit, unit);
      if (amount === null && calculate(state.recipe, current).ok) return;
      update(state, { ...current, availableUnit: unit, availableQuantity: amount === null ? current.availableQuantity : String(amount) });
    },
    undo(state) {
      const previous = state.history.pop();
      if (previous) state.current = previous;
      state.editing = null;
    },
    reset(state) {
      update(state, originalSettings(state.recipe));
    },
  },
});

export const scalingActions = scaling.actions;

export function makeScalingStore(recipe: ScalingRecipe) {
  return configureStore({ reducer: scaling.reducer, preloadedState: initialize(recipe) });
}

export type ScalingStore = ReturnType<typeof makeScalingStore>;

export const selectPreview = createSelector(
  [(state: Workspace) => state.recipe, (state: Workspace) => state.current],
  calculate,
);

export const selectEligibleIngredients = createSelector(
  [(state: Workspace) => state.recipe.ingredients],
  (ingredients) => {
    const labelCounts = new Map<string, number>();
    const options = ingredients.flatMap((item, index) => {
      const units = getScalingUnits(item);
      if (units.length === 0) return [];

      const label = [item.name, `${item.quantity} ${item.unit}`, item.note].filter(Boolean).join(" · ");
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      return [{ id: item.id, label, units, position: index + 1 }];
    });

    return options.map(({ id, label, units, position }) => ({
      id,
      label: labelCounts.get(label) === 1 ? label : `Ingredient ${position} · ${label}`,
      units,
    }));
  },
);

export const selectCanReset = createSelector(
  [(state: Workspace) => state.recipe, (state: Workspace) => state.current],
  (recipe, current) => !settingsMatch(current, originalSettings(recipe)),
);
