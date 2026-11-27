"use client";

import { accountText } from "@/lib/i18n/account";
import { useLocale } from "@/app/_components/language-provider";
import { Button } from "@/app/_components/material";
import { useState, useTransition } from "react";
import { saveDietaryPreferences } from "@/app/dietary-actions";
import { additionalAllergenChoices, commonAllergenChoices, dietChoices, type DietaryPreferences } from "@/lib/dietary/policy";

const allergenGroups = [
  { legend: "Common allergens to flag", choices: commonAllergenChoices },
  { legend: "Additional allergens and sensitivities", choices: additionalAllergenChoices },
] as const;

export default function DietaryPreferencesForm({ preferences }: { preferences: DietaryPreferences }) {
  const t = accountText(useLocale());
  const [draft, setDraft] = useState(preferences);
  const [feedback, setFeedback] = useState({ message: "", error: false });
  const [pending, startTransition] = useTransition();

  function persist(next: DietaryPreferences, cleared = false) {
    setFeedback({ message: "", error: false });
    startTransition(async () => {
      try {
        const result = await saveDietaryPreferences(next);
        if ("error" in result) {
          setFeedback({ message: result.error, error: true });
          return;
        }
        setDraft(next);
        setFeedback({ message: cleared ? "Dietary preferences cleared." : "Dietary preferences saved.", error: false });
      } catch {
        setFeedback({ message: "Couldn’t save your preferences. Please try again.", error: true });
      }
    });
  }

  return (
    <form className="site-panel space-y-4" aria-labelledby="dietary-title"
      onSubmit={(event) => { event.preventDefault(); persist(draft); }}
      onChange={() => setFeedback({ message: "", error: false })}>
      <div className="space-y-1">
        <h2 id="dietary-title" className="site-heading text-xl">{t("Dietary preferences")}</h2>
        <p className="text-sm text-subtle">{t("Choose which ingredient records to flag when you browse. These settings are private to your account.")}</p>
      </div>
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        <div className="grid gap-1">
          <label htmlFor="dietary-pattern" className="font-semibold">{t("Dietary pattern")}</label>
          <select id="dietary-pattern" name="diet" className="site-field w-full" value={draft.diet}
            onChange={(event) => setDraft({ ...draft, diet: event.currentTarget.value as DietaryPreferences["diet"] })}>
            {dietChoices.map(({ value, label }) => <option key={value} value={value}>{t(label)}</option>)}
          </select>
        </div>
        {allergenGroups.map(({ legend, choices }) => (
          <fieldset key={legend} className="min-w-0">
            <legend className="mb-1 font-semibold">{t(legend)}</legend>
            <div className="grid grid-cols-2 gap-x-3">
              {choices.map(({ value, label }) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="allergens" value={value} className="size-4 shrink-0 accent-brand"
                    checked={draft.allergens.includes(value)} onChange={(event) => {
                      const allergens = event.currentTarget.checked
                        ? [...draft.allergens, value]
                        : draft.allergens.filter((entry) => entry !== value);
                      setDraft({ ...draft, allergens });
                    }} />
                  {t(label)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="text-sm text-subtle">{t("Ingredient records can be incomplete. Check product labels and preparation for possible cross-contact.")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={pending}>{t(pending ? "Saving…" : "Save preferences")}</Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={pending}
            onClick={() => persist({ diet: "NONE", allergens: [] }, true)}>{t("Clear preferences")}</Button>
        </div>
      </fieldset>
      {feedback.message && (
        <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-sm text-rust" : "text-sm text-subtle"}>
          {t(feedback.message)}
        </p>
      )}
    </form>
  );
}
