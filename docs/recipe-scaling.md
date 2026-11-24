# Ingredient scaling in the recipe detail view

`scaleRecipe(original, request)` runs synchronously in a Client Component or a Redux selector. Fetch the recipe in the detail Server Component with `getRecipe(id)` or the recipe service’s `getById(id)`. After the existing visibility check, pass the returned recipe to the client as a prop. Its decimal strings, ordered ingredient IDs, units, and notes already fit `ScalingRecipe`. [Engine](../lib/recipes/scaling.ts) · [Recipe detail service](../lib/recipes/service.ts)

## Workspace state

The recipe detail route passes its authorized recipe snapshot to the [scaling workspace](../app/recipes/_components/scaling-workspace.tsx). The workspace creates a dedicated [Redux store](../lib/recipes/scaling-workspace.ts) for that recipe. Opening a different recipe creates a new store initialized with its base servings.

The selector runs the engine against the original quantities after each input change. Switching to serving mode uses the current result’s implied servings. Switching to ingredient mode uses the selected row’s unrounded amount and a compatible unit. Changing a unit converts the available amount to keep the current batch size. The selected row’s ID distinguishes duplicate ingredient names.

Undo restores the previous settings across the controls and preview. A continuous edit within one quantity field contributes one undo step. Reset restores the original servings and can itself be undone. Invalid input shows its error and the original quantities until the input is corrected.

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
