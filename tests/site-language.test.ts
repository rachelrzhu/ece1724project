import { expect, it } from "vitest";
import { makeTranslator, preferredLocale } from "@/lib/i18n";
import { prepareRecipeText } from "@/lib/i18n/recipe-copy";
import { demoRecipes } from "../scripts/demo-recipes";

it("uses a saved choice across visits and otherwise negotiates supported browser languages", () => {
  expect(preferredLocale("fr", "en-US")).toBe("fr");
  expect(preferredLocale("invalid", "es, fr-CA;q=0.4, zh-Hant;q=0.8")).toBe("zh");
  expect(preferredLocale(undefined, "fr-FR, en;q=0.9")).toBe("fr");
  expect(preferredLocale(undefined, "fr;q=0, de")).toBe("en");
});

it("keeps user-provided values intact when translated labels reorder placeholders", () => {
  const messages = { "{name} has {count} recipes": ["共 {count} 道食谱，作者为 {name}", "{name} a {count} recettes"] } as const;
  const t = makeTranslator("zh", messages);
  expect(t("{name} has {count} recipes", { name: "Cook {count}", count: 3 })).toBe("共 3 道食谱，作者为 Cook {count}");
});

it("renders every shipped recipe in the selected language before Chrome loads a model", () => {
  for (const recipe of demoRecipes) {
    const copy = [recipe.title, recipe.description, ...recipe.steps, ...recipe.ingredients.flatMap(item => item[3] ? [item[3]] : [])];
    for (const locale of ["en", "zh", "fr"] as const) {
      const { texts, catalogText } = prepareRecipeText(copy, locale);
      expect(texts, recipe.title).toEqual([]);
      for (const source of copy) {
        if (locale === "en") expect(catalogText[source]).toBeUndefined();
        else expect(catalogText[source]?.trim(), source).toBeTruthy();
      }
    }
  }
});

it("asks Chrome to translate only the edited or custom parts of a recipe", () => {
  const recipe = demoRecipes[0];
  const edited = recipe.steps[0] + " Add an extra clove of garlic.";
  const { texts, catalogText } = prepareRecipeText([recipe.title, edited, edited, "constructor"], "fr");
  expect(Object.keys(catalogText)).toEqual([recipe.title]);
  expect(texts).toEqual([edited, "constructor"]);
});
