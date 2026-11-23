# Ingredient scaling in the recipe detail view

`scaleRecipe(original, request)` runs synchronously in a Client Component or a Redux selector. Fetch the recipe in the detail Server Component with `getRecipe(id)` or the recipe service’s `getById(id)`. After the existing visibility check, pass the returned recipe to the client as a prop. Its decimal strings, ordered ingredient IDs, units, and notes already fit `ScalingRecipe`. [Engine](../lib/recipes/scaling.ts) · [Recipe detail service](../lib/recipes/service.ts)

## Connect the controls

For a four-serving recipe with 400 g of flour, the first request below produces six servings and 600 g. The second produces two servings and 200 g when the cook has 0.2 kg. Use the selected row’s ID because a recipe can list the same ingredient twice.

```ts
import { getScalingUnits, scaleRecipe, type ScalingRecipe, type ScalingRequest } from "@/lib/recipes/scaling";

export function selectPreview(original: ScalingRecipe, request: ScalingRequest) {
  return scaleRecipe(original, request);
}

export const forSix: ScalingRequest = { mode: "servings", targetServings: 6 };

export function forAvailableFlour(flourId: string): ScalingRequest {
  return { mode: "ingredient", ingredientId: flourId, availableQuantity: 0.2, availableUnit: "kg" };
}

export function ingredientOptions(original: ScalingRecipe) {
  return original.ingredients
    .map(row => ({ id: row.id, label: row.name, units: getScalingUnits(row) }))
    .filter(option => option.units.length > 0);
}
```

Keep the original recipe as the selector input. Keep the current request and its history in the recipe workspace. Undo restores the previous request. Reset uses `{ mode: "servings", targetServings: original.baseServings }`. To preserve the batch size when switching to serving mode, use the current result’s `servings`. When switching to ingredient mode, take an eligible row’s unrounded `scaledQuantity` and use `getScalingUnits(row)[0]` as the available unit. This first choice is the canonical spelling of the recipe unit, so a row stored in `ml` starts with `mL` selected. Clear the history when opening a different recipe.

## Render the result

```tsx
import { formatScaledQuantity, type ScalingResult } from "@/lib/recipes/scaling";

export function ScalingPreview({ result }: { result: ScalingResult }) {
  if (!result.ok) return <p role="alert">{result.error.message}</p>;

  return (
    <section>
      <p>Servings: {formatScaledQuantity(result.servings)}</p>
      <ul>
        {result.ingredients.map(row => (
          <li key={row.id}>
            {row.scaledQuantity !== null && <>{formatScaledQuantity(row.scaledQuantity)} {row.unit} </>}
            {row.name}{row.note && ` (${row.note})`}
          </li>
        ))}
      </ul>
      {result.warnings.map(warning => (
        <p key={warning.code + ("ingredientId" in warning ? warning.ingredientId : "")}>
          {warning.message}
        </p>
      ))}
    </section>
  );
}
```

Use `result.error.field` to place validation feedback beside the relevant control. Rows keep their original `quantity` and unit. Use `scaledQuantity` for the preview and the original recipe for edits. The engine uses JavaScript numbers for calculations. `formatScaledQuantity` rounds displayed numbers to at most six significant digits.

The unit menu groups compatible measurements. A kilogram is 1,000 g, a litre is 1,000 mL, a metric teaspoon is 5 mL, and a metric tablespoon is 15 mL. Counts scale numerically and fractional counts generate a warning. An unmeasured row such as “salt to taste” keeps its note. An unfamiliar unit still scales by a numeric factor, while its empty unit menu keeps it out of the available-ingredient selector.
