import { makeTranslator, type Locale, type Messages } from "@/lib/i18n";
import { scalingMessages } from "@/lib/i18n/recipe-detail";
import { unitMessages } from "@/lib/i18n/units";
import { findUnit, units } from "./measurements";
export { formatScaledQuantity } from "./measurements";

// Recipe detail responses use decimal strings. Number inputs also work for form controls.
type DecimalInput = number | string;

export interface ScalingIngredient {
  id: string;
  name: string;
  quantity: DecimalInput | null;
  unit: string | null;
  note: string | null;
}

export interface ScalingRecipe {
  baseServings: DecimalInput;
  ingredients: readonly ScalingIngredient[];
}

export type ScalingRequest =
  | { mode: "servings"; targetServings: DecimalInput }
  | { mode: "ingredient"; ingredientId: string; availableQuantity: DecimalInput; availableUnit: string };

type ScalingWarning =
  | { code: "fractional-count"; ingredientId: string; message: string }
  | { code: "cooking-conditions"; message: string };

type ErrorField = "baseServings" | "targetServings" | "ingredientId" | "availableQuantity" | "availableUnit" | "quantity";
type ScalingFailure = { ok: false; error: { field: ErrorField; message: string; ingredientId?: string } };

export type ScalingResult = ScalingFailure | {
  ok: true;
  factor: number;
  servings: number;
  ingredients: (ScalingIngredient & { scaledQuantity: number | null })[];
  warnings: ScalingWarning[];
};

function positiveNumber(value: DecimalInput | null) {
  // Number() alone accepts empty strings and hexadecimal strings from text fields.
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    value = Number(text);
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Compatible choices for the amount control, with the recipe's own unit first. */
export function getScalingUnits(ingredient: ScalingIngredient): string[] {
  if (positiveNumber(ingredient.quantity) === null) return [];
  const source = findUnit(ingredient.unit);
  if (!source) return [];
  const others = units.filter((unit) => unit.dimension === source.dimension && unit !== source);
  return [source.symbol, ...others.map((unit) => unit.symbol)];
}

function convertQuantity(quantity: number, source: typeof units[number], target: typeof units[number]): number {
  return quantity * (source.size / target.size);
}

/** Convert a positive quantity between two units in the same supported dimension. */
export function convertScalingQuantity(value: DecimalInput, from: string, to: string): number | null {
  const quantity = positiveNumber(value);
  const source = findUnit(from);
  const target = findUnit(to);
  if (quantity === null || !source || !target || source.dimension !== target.dimension) return null;
  return positiveNumber(convertQuantity(quantity, source, target));
}

function failure(field: ErrorField, message: string, ingredientId?: string): ScalingFailure {
  return { ok: false, error: { field, message, ...(ingredientId !== undefined && { ingredientId }) } };
}

function resolveScale(recipe: ScalingRecipe, request: ScalingRequest, locale: Locale) {
  const t = makeTranslator(locale, scalingMessages);
  const baseServings = positiveNumber(recipe.baseServings);
  if (baseServings === null) return failure("baseServings", t("The recipe needs a positive base serving count."));

  if (request.mode === "servings") {
    const servings = positiveNumber(request.targetServings);
    if (servings === null) return failure("targetServings", t("Enter a positive number of servings."));
    return { ok: true as const, servings, factor: servings / baseServings };
  }

  const selected = recipe.ingredients.find((row) => row.id === request.ingredientId);
  if (!selected) return failure("ingredientId", t("Choose an ingredient in this recipe."));
  const required = positiveNumber(selected.quantity);
  if (required === null) return failure("ingredientId", t("Choose an ingredient with a positive measured quantity."), selected.id);

  const source = findUnit(selected.unit);
  if (!source) return failure("ingredientId", t("Choose an ingredient with a supported unit."), selected.id);
  const availableUnit = findUnit(request.availableUnit);
  if (!availableUnit || source.dimension !== availableUnit.dimension) {
    return failure("availableUnit", t("Choose a unit compatible with {unit}.", { unit: makeTranslator<Messages>(locale, unitMessages)(source.symbol) }), selected.id);
  }
  const available = positiveNumber(request.availableQuantity);
  if (available === null) return failure("availableQuantity", t("Enter a positive available quantity."), selected.id);

  // Express the recipe requirement in the user's unit before taking the ratio.
  const requiredInAvailableUnit = convertQuantity(required, source, availableUnit);
  const factor = available / requiredInAvailableUnit;
  return { ok: true as const, servings: baseServings * factor, factor };
}

function isFractionalCount(quantity: number) {
  const nearest = Math.round(quantity);
  // Allow multiplication/division noise near whole items. Cap the tolerance below ordinary recipe fractions.
  const tolerance = Math.min(1 / 16, 4 * Number.EPSILON * quantity);
  return nearest === 0 || Math.abs(quantity - nearest) > tolerance;
}

/** Derive a preview from the original recipe and the current controls on every call. */
export function scaleRecipe(recipe: ScalingRecipe, request: ScalingRequest, locale: Locale = "en"): ScalingResult {
  const t = makeTranslator(locale, scalingMessages);
  const scale = resolveScale(recipe, request, locale);
  if (!scale.ok) return scale;
  const { factor, servings } = scale;
  if (positiveNumber(factor) === null || positiveNumber(servings) === null) {
    const field = request.mode === "servings" ? "targetServings" : "availableQuantity";
    return failure(field, t("This amount is outside the supported calculation range."));
  }

  const ingredients: (ScalingIngredient & { scaledQuantity: number | null })[] = [];
  const warnings: ScalingWarning[] = [];
  for (const row of recipe.ingredients) {
    if (row.quantity === null) {
      ingredients.push({ ...row, scaledQuantity: null });
      continue;
    }
    const original = positiveNumber(row.quantity);
    if (original === null) return failure("quantity", t("Check the quantity for {name}.", { name: row.name }), row.id);
    const scaledQuantity = factor * original;
    if (positiveNumber(scaledQuantity) === null) {
      return failure("quantity", t("The scaled quantity for {name} is outside the supported range.", { name: row.name }), row.id);
    }
    ingredients.push({ ...row, scaledQuantity });
    if (findUnit(row.unit)?.dimension === "count" && isFractionalCount(scaledQuantity)) {
      warnings.push({ code: "fractional-count", ingredientId: row.id, message: t("{name} scales to a fraction of a whole item.", { name: row.name }) });
    }
  }
  if (factor !== 1) {
    warnings.push({ code: "cooking-conditions", message: t("The original cooking time and temperature may need adjustment.") });
  }
  return { ok: true, factor, servings, ingredients, warnings };
}
