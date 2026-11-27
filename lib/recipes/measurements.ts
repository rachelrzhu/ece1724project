import type { Locale } from "@/lib/i18n";

export const MAX_SERVINGS = 100;
export const MIN_QUANTITY = 0.1;
export const MAX_QUANTITY = 1_000_000;

// The menu order and canonical symbols match the measurement_units catalogue.
// A cup uses 240 mL, equivalent to sixteen 15 mL tablespoons.
export const units = [
  { symbol: "g", dimension: "mass", size: 1, names: ["gram", "grams"] },
  { symbol: "kg", dimension: "mass", size: 1000, names: ["kilogram", "kilograms"] },
  { symbol: "mL", dimension: "volume", size: 1, names: ["milliliter", "milliliters", "millilitre", "millilitres"] },
  { symbol: "L", dimension: "volume", size: 1000, names: ["liter", "liters", "litre", "litres"] },
  { symbol: "tsp", dimension: "volume", size: 5, names: ["teaspoon", "teaspoons"] },
  { symbol: "tbsp", dimension: "volume", size: 15, names: ["tablespoon", "tablespoons"] },
  { symbol: "cup", dimension: "volume", size: 240, names: ["cups"] },
  { symbol: "oz", dimension: "mass", size: 28.349523125, names: ["ounce", "ounces"] },
  { symbol: "lb", dimension: "mass", size: 453.59237, names: ["lbs", "pound", "pounds"] },
  { symbol: "count", dimension: "count", size: 1, names: ["each"] },
];

export const unitSymbols = units.map(unit => unit.symbol);

export function findUnit(name: string | null) {
  const key = name?.trim().toLowerCase();
  return units.find(unit => unit.symbol.toLowerCase() === key || (key && unit.names.includes(key)));
}

export function isValidQuantity(amount: number, maximum = MAX_QUANTITY) {
  return amount >= MIN_QUANTITY && amount <= maximum && Number.isInteger(amount * 10);
}

export function isValidBaseServings(amount: number) {
  return Number.isInteger(amount) && amount >= 1 && amount <= MAX_SERVINGS;
}

function quantityFormats(precision: Intl.NumberFormatOptions) {
  const options = { useGrouping: false, ...precision };
  return {
    en: new Intl.NumberFormat("en", options),
    zh: new Intl.NumberFormat("zh", options),
    fr: new Intl.NumberFormat("fr", options),
  } satisfies Record<Locale, Intl.NumberFormat>;
}

const displayFormats = quantityFormats({ maximumFractionDigits: 1 });
const convertedFormats = quantityFormats({ maximumSignificantDigits: 3 });

export function formatConvertedQuantity(value: number, locale: Locale = "en"): string {
  return convertedFormats[locale].format(value);
}

export function formatScaledQuantity(value: number, locale: Locale = "en"): string {
  const formatter = displayFormats[locale];
  const rounded = formatter.format(value);
  return rounded === "0" && value > 0 ? `<${formatter.format(0.1)}` : rounded;
}
