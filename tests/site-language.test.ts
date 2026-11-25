import { expect, it } from "vitest";
import { makeTranslator, preferredLocale } from "@/lib/i18n";

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
