"use client";

import { Button, Input } from "@/app/_components/material";
import { useId, useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { formatScaledQuantity, type ScalingRecipe } from "@/lib/recipes/scaling";
import {
  makeScalingStore,
  scalingActions,
  selectCanReset,
  selectEligibleIngredients,
  selectPreview,
  type ScalingStore,
} from "@/lib/recipes/scaling-workspace";

const useScalingDispatch = useDispatch.withTypes<ScalingStore["dispatch"]>();
const useScalingSelector = useSelector.withTypes<ReturnType<ScalingStore["getState"]>>();

function ScalingControls() {
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
      <div role="group" aria-label="Scale by" className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" variant={settings.mode === "servings" ? "solid" : "outline"}
          aria-pressed={settings.mode === "servings"} onClick={() => dispatch(scalingActions.changeMode("servings"))}>
          By servings
        </Button>
        <Button type="button" className="min-h-11" variant={settings.mode === "ingredient" ? "solid" : "outline"}
          aria-pressed={settings.mode === "ingredient"} disabled={!allowIngredientMode}
          aria-describedby={allowIngredientMode ? undefined : ingredientHelpId}
          onClick={() => dispatch(scalingActions.changeMode("ingredient"))}>
          By ingredient
        </Button>
      </div>
      {showIngredientHelp && (
        <p id={ingredientHelpId} className="text-sm text-subtle">
          Choose a measured ingredient with a standard unit. Entries such as “to taste” stay in the ingredient list.
        </p>
      )}
      {settings.mode === "servings" ? (
        <div className="grid gap-1">
          <label htmlFor={`${id}-servings`}>Target servings</label>
          <Input id={`${id}-servings`} type="text" inputMode="decimal" maxLength={32}
            className="min-h-11 max-w-48 text-base" value={settings.targetServings}
            onChange={(event) => dispatch(scalingActions.editQuantity({ field: "targetServings", value: event.target.value }))}
            onBlur={() => dispatch(scalingActions.finishEditing())} {...invalidProps("targetServings")} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-1">
            <label htmlFor={`${id}-ingredient`}>Ingredient on hand</label>
            <select id={`${id}-ingredient`} className="site-field w-full min-w-0 truncate" value={settings.ingredientId}
              onChange={(event) => dispatch(scalingActions.chooseIngredient(event.target.value))}
              {...invalidProps("ingredientId", showIngredientHelp ? ingredientHelpId : undefined)}>
              {eligible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,auto)] gap-2">
            <div className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-available`}>Available quantity</label>
              <Input id={`${id}-available`} type="text" inputMode="decimal" maxLength={32}
                className="min-h-11 min-w-0 text-base" value={settings.availableQuantity}
                onChange={(event) => dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: event.target.value }))}
                onBlur={() => dispatch(scalingActions.finishEditing())} {...invalidProps("availableQuantity")} />
            </div>
            <div className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-unit`}>Unit</label>
              <select id={`${id}-unit`} className="site-field w-full" value={settings.availableUnit}
                onChange={(event) => dispatch(scalingActions.chooseUnit(event.target.value))} {...invalidProps("availableUnit")}>
                {selected?.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
      {settings.roundedControl && <p className="text-sm text-subtle">The amount shown is rounded. Editing it sets a new batch size.</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-rust">{error.message} Showing original amounts.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={!canUndo} onClick={() => dispatch(scalingActions.undo())}>Undo</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!canReset} onClick={() => dispatch(scalingActions.reset())}>Reset</Button>
      </div>
    </div>
  );
}

function IngredientPreview() {
  const original = useScalingSelector((state) => state.recipe);
  const preview = useScalingSelector(selectPreview);
  const scaled = preview.ok && preview.factor !== 1;
  const amounts = preview.ok
    ? preview.ingredients.map(({ scaledQuantity, ...item }) => ({ ...item, quantity: scaledQuantity }))
    : original.ingredients;
  const servings = formatScaledQuantity(preview.ok ? preview.servings : Number(original.baseServings));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-canvas px-3 py-2 text-sm text-ink" role="status">
        <p className="font-semibold wrap-anywhere">Serves {servings}</p>
        {scaled && <p className="wrap-anywhere">×{formatScaledQuantity(preview.factor)} batch</p>}
      </div>
      <ul className="mt-2 divide-y divide-line" aria-label="Ingredient quantities">
        {amounts.map((item) => (
          <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,42%)] gap-3 py-3 wrap-anywhere">
            <div>
              <p className="font-semibold">{item.name}</p>
              {item.note && <p className="text-sm text-subtle">{item.note}</p>}
            </div>
            {item.quantity !== null && <span className="text-end text-subtle">{formatScaledQuantity(Number(item.quantity))} {item.unit}</span>}
          </li>
        ))}
      </ul>
      {preview.ok && preview.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 ps-7 text-sm text-amber-950" aria-label="Scaling notes">
          {preview.warnings.map((warning) => (
            <li key={warning.code === "fractional-count" ? warning.ingredientId : warning.code} className="wrap-anywhere">{warning.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScalingWorkspace({ recipe }: { recipe: ScalingRecipe }) {
  const [store] = useState(() => makeScalingStore(recipe));
  return (
    <Provider store={store}>
      <section aria-labelledby="ingredients-title" className="min-w-0 space-y-4 border-t border-line pt-4">
        <div className="space-y-1">
          <h2 id="ingredients-title" className="site-heading text-2xl">Ingredients</h2>
          <p className="text-sm text-subtle">Adjust quantities for your serving count or an ingredient you have on hand.</p>
        </div>
        <ScalingControls />
        <IngredientPreview />
      </section>
    </Provider>
  );
}
