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

const units = [
  { symbol: "g", dimension: "mass", size: 1, names: ["gram", "grams"] },
  { symbol: "kg", dimension: "mass", size: 1000, names: ["kilogram", "kilograms"] },
  { symbol: "mL", dimension: "volume", size: 1, names: ["milliliter", "milliliters", "millilitre", "millilitres"] },
  { symbol: "L", dimension: "volume", size: 1000, names: ["liter", "liters", "litre", "litres"] },
  { symbol: "tsp", dimension: "volume", size: 5, names: ["teaspoon", "teaspoons"] },
  { symbol: "tbsp", dimension: "volume", size: 15, names: ["tablespoon", "tablespoons"] },
  { symbol: "count", dimension: "count", size: 1, names: ["each"] },
];

function findUnit(name: string | null) {
  const key = name?.trim().toLowerCase();
  if (!key) return undefined;
  return units.find((unit) => unit.symbol.toLowerCase() === key || unit.names.includes(key));
}

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

const displayFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 6, useGrouping: false });

export function formatScaledQuantity(value: number): string {
  return displayFormat.format(value);
}

function failure(field: ErrorField, message: string, ingredientId?: string): ScalingFailure {
  return { ok: false, error: { field, message, ...(ingredientId !== undefined && { ingredientId }) } };
}

function resolveScale(recipe: ScalingRecipe, request: ScalingRequest) {
  const baseServings = positiveNumber(recipe.baseServings);
  if (baseServings === null) return failure("baseServings", "The recipe needs a positive base serving count.");

  if (request.mode === "servings") {
    const servings = positiveNumber(request.targetServings);
    if (servings === null) return failure("targetServings", "Enter a positive number of servings.");
    return { ok: true as const, servings, factor: servings / baseServings };
  }

  const selected = recipe.ingredients.find((row) => row.id === request.ingredientId);
  if (!selected) return failure("ingredientId", "Choose an ingredient in this recipe.");
  const required = positiveNumber(selected.quantity);
  if (required === null) return failure("ingredientId", "Choose an ingredient with a positive measured quantity.", selected.id);

  const source = findUnit(selected.unit);
  if (!source) return failure("ingredientId", "Choose an ingredient with a supported unit.", selected.id);
  const availableUnit = findUnit(request.availableUnit);
  if (!availableUnit || source.dimension !== availableUnit.dimension) {
    return failure("availableUnit", `Choose a unit compatible with ${selected.unit}.`, selected.id);
  }
  const available = positiveNumber(request.availableQuantity);
  if (available === null) return failure("availableQuantity", "Enter a positive available quantity.", selected.id);

  // Express the recipe requirement in the user's unit before taking the ratio.
  const requiredInAvailableUnit = required * (source.size / availableUnit.size);
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
export function scaleRecipe(recipe: ScalingRecipe, request: ScalingRequest): ScalingResult {
  const scale = resolveScale(recipe, request);
  if (!scale.ok) return scale;
  const { factor, servings } = scale;
  if (positiveNumber(factor) === null || positiveNumber(servings) === null) {
    const field = request.mode === "servings" ? "targetServings" : "availableQuantity";
    return failure(field, "This amount is outside the supported calculation range.");
  }

  const ingredients: (ScalingIngredient & { scaledQuantity: number | null })[] = [];
  const warnings: ScalingWarning[] = [];
  for (const row of recipe.ingredients) {
    if (row.quantity === null) {
      ingredients.push({ ...row, scaledQuantity: null });
      continue;
    }
    const original = positiveNumber(row.quantity);
    if (original === null) return failure("quantity", `Check the quantity for ${row.name}.`, row.id);
    const scaledQuantity = factor * original;
    if (positiveNumber(scaledQuantity) === null) {
      return failure("quantity", `The scaled quantity for ${row.name} is outside the supported range.`, row.id);
    }
    ingredients.push({ ...row, scaledQuantity });
    if (findUnit(row.unit)?.dimension === "count" && isFractionalCount(scaledQuantity)) {
      warnings.push({ code: "fractional-count", ingredientId: row.id, message: `${row.name} scales to a fraction of a whole item.` });
    }
  }
  if (factor !== 1) {
    warnings.push({ code: "cooking-conditions", message: "The original cooking time and temperature may need adjustment." });
  }
  return { ok: true, factor, servings, ingredients, warnings };
}
