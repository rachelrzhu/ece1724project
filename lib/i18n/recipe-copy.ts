import type { Locale } from "./index";
import { catalogRecipeMessages } from "./catalog-recipe-text";

const translations = new Map<string, readonly [string, string]>(Object.entries(catalogRecipeMessages));

export function catalogRecipeText(source: string, locale: Locale) {
  const pair = translations.get(source);
  if (pair) return locale === "en" ? source : pair[locale === "zh" ? 0 : 1];
}

// Send only the copy used on this page. Edits and cook-authored text go to Chrome.
export function prepareRecipeText(sources: readonly string[], locale: Locale) {
  const texts: string[] = [];
  const catalogText: Record<string, string> = {};
  for (const source of new Set(sources)) {
    const localized = catalogRecipeText(source, locale);
    if (localized === undefined) texts.push(source);
    else if (localized !== source) catalogText[source] = localized;
  }
  return { texts, catalogText };
}
