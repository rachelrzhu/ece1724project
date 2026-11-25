import type { z } from "zod";
import french from "zod/v4/locales/fr.js";
import chinese from "zod/v4/locales/zh-CN.js";
import { editorMessages } from "./editor";

const localeErrors = { fr: french().localeError, zh: chinese().localeError };

// Only formatted messages cross the server boundary. Keep the submitted value out of errors.
export function recipeFieldIssue(issue: z.core.$ZodIssue) {
  const message = issue.code === "unrecognized_keys" ? "Submit only the recipe fields shown." : issue.message.slice(0, 250);
  function localize(locale: "fr" | "zh") {
    if (Object.hasOwn(editorMessages, message)) {
      return editorMessages[message as keyof typeof editorMessages][locale === "zh" ? 0 : 1];
    }
    const value = localeErrors[locale]({ input: undefined, ...issue });
    return (typeof value === "string" ? value : value?.message ?? message).slice(0, 250);
  }
  return { path: issue.path.join("."), message, zh: localize("zh"), fr: localize("fr") };
}
