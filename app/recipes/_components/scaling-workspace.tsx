"use client";

import { makeTranslator, type Locale, type Messages } from "@/lib/i18n";
import { useLocale } from "@/app/_components/language-provider";
import { useRecipeTranslation, RecipeText } from "@/app/_components/recipe-translation";
import { scalingMessages } from "@/lib/i18n/recipe-detail";
import { unitMessages } from "@/lib/i18n/units";
import { Button, Input } from "@/app/_components/material";
import { useEffect, useId, useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { formatScaledQuantity, type ScalingRecipe } from "@/lib/recipes/scaling";
import {
  makeScalingStore,
  scalingActions,
  selectCanReset,
  selectDisplayRecipe,
  selectEligibleIngredients,
  selectPreview,
  type IngredientLanguage,
  type ScalingStore,
} from "@/lib/recipes/scaling-workspace";

const useScalingDispatch = useDispatch.withTypes<ScalingStore["dispatch"]>();
const useScalingSelector = useSelector.withTypes<ReturnType<ScalingStore["getState"]>>();

const languageLabels = { original: "Original names", en: "English", zh: "中文", fr: "Français" };
const languagePreferenceKey = "ingredient-language";

function isIngredientLanguage(value: string | null): value is IngredientLanguage {
  return value !== null && Object.hasOwn(languageLabels, value);
}

function preferredIngredientLanguage(locale: Locale): IngredientLanguage {
  try {
    const saved = sessionStorage.getItem(languagePreferenceKey);
    const scope = sessionStorage.getItem(languagePreferenceKey + "-locale");
    // A choice applies to this site language. Existing tab preferences predate the site switcher.
    if (isIngredientLanguage(saved) && (scope === locale || (!scope && navigator.language.split("-")[0] === locale))) return saved;
  } catch {
    // Browser privacy settings can disable storage.
  }
  return locale;
}

function IngredientLanguageSelect() {
  const id = useId();
  const dispatch = useScalingDispatch();
  const language = useScalingSelector(state => state.language);
  const locale = useLocale();
  const t = makeTranslator(locale, scalingMessages);
  const { original } = useRecipeTranslation();

  useEffect(() => {
    dispatch(scalingActions.changeLocale(locale));
    dispatch(scalingActions.changeLanguage(original ? "original" : preferredIngredientLanguage(locale)));
  }, [dispatch, locale, original]);

  function changeLanguage(value: string) {
    if (!isIngredientLanguage(value)) return;
    dispatch(scalingActions.changeLanguage(value));
    try {
      sessionStorage.setItem(languagePreferenceKey, value);
      sessionStorage.setItem(languagePreferenceKey + "-locale", locale);
    } catch {
      // The selection still applies to this recipe.
    }
  }

  return (
    <div className="grid justify-items-start gap-1">
      <label htmlFor={id}>{t("Translate ingredient names")}</label>
      <select id={id} className="site-field min-h-11" value={language} onChange={event => changeLanguage(event.target.value)}>
        {Object.entries(languageLabels).map(([value, label]) =>
          <option key={value} value={value} lang={value === "original" ? locale : value}>{value === "original" ? t("Original names") : label}</option>)}
      </select>
    </div>
  );
}

function ScalingControls() {
  const locale = useLocale();
  const t = makeTranslator(locale, scalingMessages);
  const unitLabel = makeTranslator<Messages>(locale, unitMessages);
  const { lookup } = useRecipeTranslation();
  const language = useScalingSelector(state => state.language);
  const id = useId();
  const dispatch = useScalingDispatch();
  const settings = useScalingSelector((state) => state.current);
  const canUndo = useScalingSelector((state) => state.history.length > 0);
  const canReset = useScalingSelector(selectCanReset);
  const eligible = useScalingSelector(selectEligibleIngredients);
  const ingredientCount = useScalingSelector((state) => state.recipe.ingredients.length);
  const preview = useScalingSelector(selectPreview);
  const selected = eligible.find((item) => item.id === settings.ingredientId);
  const error = preview.ok ? null : preview.error;
  const allowIngredientMode = eligible.length > 0;
  const showIngredientHelp = !allowIngredientMode || (settings.mode === "ingredient" && eligible.length < ingredientCount);
  const ingredientHelpId = `${id}-ingredient-help`;
  const errorId = `${id}-scaling-error`;

  function invalidProps(field: string, helpId?: string) {
    const isInvalid = error?.field === field;
    return {
      "aria-invalid": isInvalid || undefined,
      "aria-describedby": [helpId, isInvalid ? errorId : undefined].filter(Boolean).join(" ") || undefined,
    };
  }

  return (
    <div className="grid gap-4 rounded-md border border-line bg-canvas p-3 sm:p-4">
      <div role="group" aria-label={t("Scale by")} className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" variant={settings.mode === "servings" ? "solid" : "outline"}
          aria-pressed={settings.mode === "servings"} onClick={() => dispatch(scalingActions.changeMode("servings"))}>
          {t("By servings")}
        </Button>
        <Button type="button" className="min-h-11" variant={settings.mode === "ingredient" ? "solid" : "outline"}
          aria-pressed={settings.mode === "ingredient"} disabled={!allowIngredientMode}
          aria-describedby={allowIngredientMode ? undefined : ingredientHelpId}
          onClick={() => dispatch(scalingActions.changeMode("ingredient"))}>
          {t("By ingredient")}
        </Button>
      </div>
      {showIngredientHelp && (
        <p id={ingredientHelpId} className="text-sm text-subtle">
          {t("Choose a measured ingredient with a standard unit. Entries such as “to taste” stay in the ingredient list.")}
        </p>
      )}
      {settings.mode === "servings" ? (
        <div className="grid gap-1">
          <label htmlFor={`${id}-servings`}>{t("Target servings")}</label>
          <Input id={`${id}-servings`} type="text" inputMode="decimal" maxLength={32}
            className="min-h-11 max-w-48 text-base" value={settings.targetServings}
            onChange={(event) => dispatch(scalingActions.editQuantity({ field: "targetServings", value: event.target.value }))}
            onBlur={() => dispatch(scalingActions.finishEditing())} {...invalidProps("targetServings")} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-1">
            <label htmlFor={`${id}-ingredient`}>{t("Ingredient on hand")}</label>
            <select id={`${id}-ingredient`} className="site-field w-full min-w-0 truncate" value={settings.ingredientId}
              onChange={(event) => dispatch(scalingActions.chooseIngredient(event.target.value))}
              {...invalidProps("ingredientId", showIngredientHelp ? ingredientHelpId : undefined)}>
              {eligible.map((item) => <option key={item.id} value={item.id}>{language === locale ? lookup(item.name) : item.name}</option>)}
            </select>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,auto)] gap-2">
            <div className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-available`}>{t("Available quantity")}</label>
              <Input id={`${id}-available`} type="text" inputMode="decimal" maxLength={32}
                className="min-h-11 min-w-0 text-base" value={settings.availableQuantity}
                onChange={(event) => dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: event.target.value }))}
                onBlur={() => dispatch(scalingActions.finishEditing())} {...invalidProps("availableQuantity")} />
            </div>
            <div className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-unit`}>{t("Unit")}</label>
              <select id={`${id}-unit`} className="site-field w-full" value={settings.availableUnit}
                onChange={(event) => dispatch(scalingActions.chooseUnit(event.target.value))} {...invalidProps("availableUnit")}>
                {selected?.units.map((unit) => <option key={unit} value={unit}>{unitLabel(unit)}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
      {settings.roundedControl && <p className="text-sm text-subtle">{t("The amount shown is rounded. Editing it sets a new batch size.")}</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-rust">{error.message} {t("Showing original amounts.")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={!canUndo} onClick={() => dispatch(scalingActions.undo())}>{t("Undo")}</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!canReset} onClick={() => dispatch(scalingActions.reset())}>{t("Reset")}</Button>
      </div>
    </div>
  );
}

function IngredientPreview() {
  const locale = useLocale();
  const t = makeTranslator(locale, scalingMessages);
  const unitLabel = makeTranslator<Messages>(locale, unitMessages);
  const { lookup } = useRecipeTranslation();
  const original = useScalingSelector(selectDisplayRecipe);
  const language = useScalingSelector(state => state.language);
  const preview = useScalingSelector(selectPreview);
  const scaled = preview.ok && preview.factor !== 1;
  const amounts = preview.ok
    ? preview.ingredients.map(({ scaledQuantity, ...item }) => ({ ...item, quantity: scaledQuantity }))
    : original.ingredients;
  const servings = formatScaledQuantity(preview.ok ? preview.servings : Number(original.baseServings));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-canvas px-3 py-2 text-sm text-ink" role="status">
        <p className="font-semibold wrap-anywhere">{t("Serves {servings}", { servings })}</p>
        {scaled && <p className="wrap-anywhere">{t("×{factor} batch", { factor: formatScaledQuantity(preview.factor) })}</p>}
      </div>
      <ul className="mt-2 divide-y divide-line" aria-label={t("Ingredient quantities")}>
        {amounts.map((item) => (
          <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,42%)] gap-3 py-3 wrap-anywhere">
            <div>
              <p className="font-semibold" lang={language !== "original" && item.translations ? language : undefined}>{language === locale && !item.translations ? lookup(item.name) : item.name}</p>
              {item.note && <p className="text-sm text-subtle"><RecipeText text={item.note} /></p>}
            </div>
            {item.quantity !== null && <span className="text-end text-subtle">{formatScaledQuantity(Number(item.quantity))} {item.unit ? unitLabel(item.unit) : ""}</span>}
          </li>
        ))}
      </ul>
      {preview.ok && preview.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 ps-7 text-sm text-amber-950" aria-label={t("Scaling notes")}>
          {preview.warnings.map((warning) => (
            <li key={warning.code === "fractional-count" ? warning.ingredientId : warning.code} className="wrap-anywhere">{warning.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScalingWorkspace({ recipe }: { recipe: ScalingRecipe }) {
  const locale = useLocale();
  const t = makeTranslator(locale, scalingMessages);
  const [store] = useState(() => makeScalingStore(recipe, locale, locale));
  return (
    <Provider store={store}>
      <section aria-labelledby="ingredients-title" className="min-w-0 space-y-4 border-t border-line pt-4">
        <div className="space-y-1">
          <h2 id="ingredients-title" className="site-heading text-2xl">{t("Ingredients")}</h2>
          <p className="text-sm text-subtle">{t("Adjust quantities for your serving count or an ingredient you have on hand.")}</p>
        </div>
        <IngredientLanguageSelect />
        <ScalingControls />
        <IngredientPreview />
      </section>
    </Provider>
  );
}
