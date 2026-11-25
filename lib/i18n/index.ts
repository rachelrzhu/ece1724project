export const languageNames = { en: "English", zh: "中文", fr: "Français" } as const;
export type Locale = keyof typeof languageNames;
export type Messages = Record<string, readonly [chinese: string, french: string]>;
export const languageCookie = "kitchen-language";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(languageNames, value);
}

export function preferredLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  let best: Locale = "en";
  let bestWeight = 0;
  for (const entry of (acceptLanguage ?? "").split(",")) {
    const [tag, quality] = entry.trim().toLowerCase().split(/\s*;\s*q\s*=\s*/);
    const language = tag.split("-")[0];
    const weight = quality === undefined ? 1 : Number(quality);
    if (isLocale(language) && weight > bestWeight && weight <= 1) {
      best = language;
      bestWeight = weight;
    }
  }
  return best;
}

export function makeTranslator<M extends Messages>(locale: Locale, messages: M) {
  return (key: keyof M & string, values: Record<string, string | number> = {}): string => {
    const template = locale === "en" ? key : messages[key]?.[locale === "zh" ? 0 : 1] ?? key;
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : placeholder);
  };
}
