# Ingredient scaling in the recipe detail view

`scaleRecipe(original, request)` runs synchronously in a Client Component or a Redux selector. The detail Server Component calls `getRecipe(id)`, which enforces recipe visibility, then passes the original serving count and ordered ingredients to the client. Decimal strings, ingredient IDs, units, and notes fit `ScalingRecipe` directly. [Engine](../lib/recipes/scaling.ts) · [Recipe queries](../lib/product/queries.ts)

## Workspace state

The recipe detail route passes its authorized recipe snapshot to the [scaling workspace](../app/recipes/_components/scaling-workspace.tsx). The workspace creates a dedicated [Redux store](../lib/recipes/scaling-workspace.ts) for that recipe. Opening a different recipe creates a new store initialized with its base servings.

The workspace accepts 0.1–100 target servings or 0.1–1,000,000 units of an available ingredient, with at most one decimal place. The selector runs the engine against the original quantities after each valid input change. Switching to serving mode uses the current result’s implied servings. Switching to ingredient mode uses the selected row’s unrounded amount and a compatible unit. Changing a unit converts the available amount to keep the current batch size. The selected row’s ID distinguishes duplicate ingredient names.

Undo restores the previous settings across the controls and preview. A continuous edit within one quantity field contributes one undo step. Reset restores the original servings and can itself be undone. Invalid input shows its error and the original quantities until the input is corrected.

## Example requests

For a four-serving recipe with 400 g of flour, these requests show how each mode uses the original recipe. Pass the flour row’s ID to select it even if the same ingredient appears twice.

```ts
const forSix = scaleRecipe(original, { mode: "servings", targetServings: 6 });
// Six servings, 600 g of flour.
const fromFlour = scaleRecipe(original, {
  mode: "ingredient", ingredientId: flourId, availableQuantity: 0.2, availableUnit: "kg",
});
// Two servings, 200 g of flour.
```

`getScalingUnits(row)` returns compatible units with the recipe unit first, using its canonical spelling (for example, `mL` for a row stored in `ml`).

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

Use `result.error.field` to place validation feedback beside the relevant control. Rows keep their original `quantity` and unit. Use `scaledQuantity` for the preview and the original recipe for edits. The engine uses JavaScript numbers for calculations. Servings, batch factors, and quantities shown in their original units use at most one decimal place. A positive value that would round to zero appears as `<0.1`. The editor preserves older, higher-precision measurements until the author chooses to change them.

The **Ingredient units** control applies to the whole list. It starts in **Original** and remembers the cook’s selection in a browser cookie. **Metric** and **Imperial** choose units within each ingredient’s dimension. For example, 2 tsp becomes 10 mL, and 400 g becomes 14.1 oz. Converted values use up to three significant digits so even a small amount such as 0.0353 oz stays measurable. Switching units always starts from the unrounded quantity for the current batch.

The database supplies the recipe editor’s common-unit menu. New recipes use 1–100 whole servings. Scaling accepts targets from 0.1 to 100 servings, and measured amounts from 0.1 to 1,000,000, with at most one decimal. Switching units or modes retains the exact batch behind the rounded control until the cook edits it.

The scaling unit menu groups compatible measurements. A kilogram is 1,000 g, a litre is 1,000 mL, a metric teaspoon is 5 mL, and a metric tablespoon is 15 mL, and the recipe cup is 240 mL. A cup uses 240 mL, a pound uses 16 ounces, and an ounce uses 28.349523125 g. Counts scale numerically and fractional counts generate a warning. An unmeasured row such as “salt to taste” keeps its note. An unfamiliar unit still scales by a numeric factor, while its empty unit menu keeps it out of the available-ingredient selector.
