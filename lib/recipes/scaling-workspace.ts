import { makeTranslator, type Locale } from "@/lib/i18n";
import { scalingMessages } from "@/lib/i18n/recipe-detail";
import { formatScaledQuantity, isValidQuantity, MAX_QUANTITY, MAX_SERVINGS } from "./measurements";
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
  // Keep the exact batch when a mode or unit change rounds the editable display.
  derivedServings: number | null;
  roundedControl: boolean;
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
    targetServings: formatScaledQuantity(Number(recipe.baseServings)),
    derivedServings: Number(recipe.baseServings),
    roundedControl: Number(formatScaledQuantity(Number(recipe.baseServings))) !== Number(recipe.baseServings),
    ingredientId: firstMeasured?.id ?? "",
    availableQuantity: firstMeasured?.quantity ? formatScaledQuantity(Number(firstMeasured.quantity)) : "",
    availableUnit: firstMeasured ? getScalingUnits(firstMeasured)[0] : "",
  };
}

function initialize(recipe: ScalingRecipe): Workspace {
  return { recipe, current: originalSettings(recipe), history: [], editing: null };
}

function calculate(recipe: ScalingRecipe, settings: Settings, locale: Locale = "en"): ScalingResult {
  const t = makeTranslator(locale, scalingMessages);
  if (settings.derivedServings !== null) {
    return scaleRecipe(recipe, { mode: "servings", targetServings: settings.derivedServings }, locale);
  }
  const servingsMode = settings.mode === "servings";
  const field = servingsMode ? "targetServings" : "availableQuantity";
  // Accept either decimal separator so a language change also preserves an in-progress amount.
  const value = settings[field].replace(",", ".");
  const max = servingsMode ? MAX_SERVINGS : MAX_QUANTITY;
  if (!/^(?:\d+(?:\.\d?)?|\.\d)$/.test(value) || !isValidQuantity(Number(value), max)) {
    return { ok: false, error: { field,
      message: t(servingsMode ? "Enter servings from 0.1 to {max} with at most one decimal place."
        : "Enter an available quantity from 0.1 to {max} with at most one decimal place.", { max: max.toLocaleString(locale) }),
    } };
  }
  if (servingsMode) return scaleRecipe(recipe, { mode: "servings", targetServings: value }, locale);
  const result = scaleRecipe(recipe, {
    mode: "ingredient", ingredientId: settings.ingredientId, availableQuantity: value, availableUnit: settings.availableUnit,
  }, locale);
  if (result.ok && result.servings > MAX_SERVINGS) {
    return { ok: false, error: { field, message: t("Choose a quantity that yields at most {max} servings.", { max: MAX_SERVINGS }) } };
  }
  return result;
}

function settingsMatch(current: Settings, next: Settings) {
  return current.mode === next.mode && current.derivedServings === next.derivedServings && current.targetServings === next.targetServings
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
    targetServings: formatScaledQuantity(result.servings),
    derivedServings: result.servings,
    roundedControl: Number(formatScaledQuantity(amount)) !== amount,
    ingredientId: item.id,
    availableQuantity: formatScaledQuantity(amount),
    availableUnit: unit,
  };
}

const scaling = createSlice({
  name: "scaling",
  initialState: initialize({ baseServings: 1, ingredients: [] }),
  reducers: {
    editQuantity(state, action: PayloadAction<{ field: QuantityField; value: string }>) {
      const { field, value } = action.payload;
      update(state, { ...state.current, [field]: value, derivedServings: null, roundedControl: false }, field);
    },
    finishEditing(state) {
      state.editing = null;
    },
    changeMode(state, { payload: mode }: PayloadAction<Mode>) {
      const current = state.current;
      if (current.mode === mode) return;

      if (mode === "servings") {
        const result = validScale(state);
        if (result.ok) {
          const targetServings = formatScaledQuantity(result.servings);
          update(state, { ...current, mode, targetServings, derivedServings: result.servings,
            roundedControl: Number(targetServings) !== result.servings });
        }
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
      const next = calculate(state.recipe, current).ok ? withIngredient(state, item.id, unit) : null;
      update(state, next ?? { ...current, availableUnit: unit });
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

function selectRecipe(state: Workspace, displayRecipe?: ScalingRecipe) {
  return displayRecipe ?? state.recipe;
}

export const selectPreview = createSelector(
  [selectRecipe, (state: Workspace) => state.current, (_state: Workspace, _recipe?: ScalingRecipe, locale: Locale = "en") => locale],
  calculate,
);

export const selectEligibleIngredients = createSelector(
  [selectRecipe],
  (recipe) => recipe.ingredients.flatMap((item) => {
    const units = getScalingUnits(item);
    return units.length ? [{ id: item.id, name: item.name, units }] : [];
  }),
);

export const selectCanReset = createSelector(
  [(state: Workspace) => state.recipe, (state: Workspace) => state.current],
  (recipe, current) => !settingsMatch(current, originalSettings(recipe)),
);
