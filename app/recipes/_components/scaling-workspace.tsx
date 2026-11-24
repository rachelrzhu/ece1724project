"use client";

import { Button, Input, Label } from "@heroui/react";
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
  const preview = useScalingSelector(selectPreview);
  const selected = eligible.find((item) => item.id === settings.ingredientId);
  const error = preview.ok ? null : preview.error;
  const allowIngredientMode = eligible.length > 0;
  const errorId = `${id}-scaling-error`;

  function invalidProps(field: string) {
    const isInvalid = error?.field === field;
    return { "aria-invalid": isInvalid || undefined, "aria-describedby": isInvalid ? errorId : undefined };
  }

  return (
    <div className="grid gap-4 rounded-md border border-line bg-canvas p-3 sm:p-4">
      <div role="group" aria-label="Scale by" className="flex flex-wrap gap-2">
        <Button type="button" className={settings.mode === "servings" ? "site-button" : "site-button-outline"}
          aria-pressed={settings.mode === "servings"} onPress={() => dispatch(scalingActions.changeMode("servings"))}>
          By servings
        </Button>
        <Button type="button" className={settings.mode === "ingredient" ? "site-button" : "site-button-outline"}
          aria-pressed={settings.mode === "ingredient"} isDisabled={!allowIngredientMode}
          aria-describedby={allowIngredientMode ? undefined : `${id}-no-ingredients`}
          onPress={() => dispatch(scalingActions.changeMode("ingredient"))}>
          By ingredient
        </Button>
      </div>
      {!allowIngredientMode && (
        <p id={`${id}-no-ingredients`} className="text-sm text-subtle">
          Ingredient scaling needs a measured ingredient in g, kg, mL, L, tsp, tbsp, or count.
        </p>
      )}
      {settings.mode === "servings" ? (
        <div className="grid gap-1">
          <Label htmlFor={`${id}-servings`}>Target servings</Label>
          <Input id={`${id}-servings`} type="text" inputMode="decimal" maxLength={32}
            className="site-field max-w-48" value={settings.targetServings}
            onChange={(event) => dispatch(scalingActions.editQuantity({ field: "targetServings", value: event.target.value }))}
            onBlur={() => dispatch(scalingActions.finishEditing())} {...invalidProps("targetServings")} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-1">
            <Label htmlFor={`${id}-ingredient`}>Ingredient on hand</Label>
            <select id={`${id}-ingredient`} className="site-field w-full min-w-0" value={settings.ingredientId}
              onChange={(event) => dispatch(scalingActions.chooseIngredient(event.target.value))} {...invalidProps("ingredientId")}>
              {eligible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,auto)] gap-2">
            <div className="grid min-w-0 gap-1">
              <Label htmlFor={`${id}-available`}>Available quantity</Label>
              <Input id={`${id}-available`} type="text" inputMode="decimal" maxLength={32} fullWidth
                className="site-field min-w-0" value={settings.availableQuantity}
                onChange={(event) => dispatch(scalingActions.editQuantity({ field: "availableQuantity", value: event.target.value }))}
                onBlur={() => dispatch(scalingActions.finishEditing())} {...invalidProps("availableQuantity")} />
            </div>
            <div className="grid min-w-0 gap-1">
              <Label htmlFor={`${id}-unit`}>Unit</Label>
              <select id={`${id}-unit`} className="site-field w-full" value={settings.availableUnit}
                onChange={(event) => dispatch(scalingActions.chooseUnit(event.target.value))} {...invalidProps("availableUnit")}>
                {selected?.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
      {error && <p id={errorId} role="alert" className="text-sm text-rust">{error.message} Showing original amounts.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="site-button-outline" isDisabled={!canUndo} onPress={() => dispatch(scalingActions.undo())}>Undo</Button>
        <Button type="button" className="site-button-outline" isDisabled={!canReset} onPress={() => dispatch(scalingActions.reset())}>Reset</Button>
      </div>
    </div>
  );
}

function IngredientPreview() {
  const original = useScalingSelector((state) => state.recipe);
  const preview = useScalingSelector(selectPreview);
  const amounts = preview.ok
    ? preview.ingredients.map(({ scaledQuantity, ...item }) => ({
      ...item, quantity: scaledQuantity === null ? null : formatScaledQuantity(scaledQuantity),
    }))
    : original.ingredients;
  const servings = preview.ok ? formatScaledQuantity(preview.servings) : String(original.baseServings);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-canvas px-3 py-2 text-sm text-ink" role="status">
        <p className="font-semibold wrap-anywhere">Serves {servings}</p>
        {preview.ok && preview.factor !== 1 && <p className="wrap-anywhere">×{formatScaledQuantity(preview.factor)} batch</p>}
      </div>
      <ul className="mt-2 divide-y divide-line" aria-label="Ingredient quantities">
        {amounts.map((item) => (
          <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,42%)] gap-3 py-3 wrap-anywhere">
            <div>
              <p className="font-semibold">{item.name}</p>
              {item.note && <p className="text-sm text-subtle">{item.note}</p>}
            </div>
            {item.quantity !== null && <span className="text-end text-subtle">{item.quantity} {item.unit}</span>}
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
