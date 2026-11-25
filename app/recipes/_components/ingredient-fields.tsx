import { Button, Input } from "@/app/_components/material";
import { useState } from "react";
import type { RecipeDetailData } from "@/lib/product/queries";

type Ingredient = RecipeDetailData["ingredients"][number];

export default function IngredientFields({
  ingredient,
  number,
  canRemove,
  onRemove,
}: {
  ingredient: Ingredient;
  number: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(ingredient.quantity ?? "");
  const hasQuantity = quantity !== "";
  const preservePrecision = quantity === ingredient.quantity && Number(quantity) * 10 % 1 !== 0;
  const prefix = `ingredient-${ingredient.id}`;

  return (
    <fieldset className="min-w-0 rounded-lg border border-line p-3 sm:p-4">
      <legend className="px-1 font-semibold">Ingredient {number}</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-name`}>Name</label>
          <Input id={`${prefix}-name`} name={`${prefix}-name`} defaultValue={ingredient.name}
            className="min-h-11 text-base" maxLength={160} required />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-quantity`}>Quantity (optional, up to 1 decimal place)</label>
          <Input
            id={`${prefix}-quantity`}
            name={`${prefix}-quantity`}
            type="number"
            inputMode="decimal"
            className="min-h-11 text-base"
            min={preservePrecision ? "0.000001" : "0.1"}
            max="1000000"
            step={preservePrecision ? "0.000001" : "0.1"}
            defaultValue={ingredient.quantity ?? ""}
            onChange={(event) => setQuantity(event.currentTarget.value)}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-unit`}>Unit</label>
          <Input id={`${prefix}-unit`} name={`${prefix}-unit`} defaultValue={ingredient.unit ?? ""}
            required={hasQuantity} className="min-h-11 text-base" maxLength={32} placeholder="e.g. cup or count" />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-note`}>Note</label>
          <Input id={`${prefix}-note`} name={`${prefix}-note`} defaultValue={ingredient.note ?? ""}
            required={!hasQuantity} className="min-h-11 text-base" maxLength={300} placeholder="e.g. to taste" />
        </div>
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canRemove}
          aria-label={`Remove ingredient ${number}`}
          onClick={onRemove}
        >
          Remove ingredient
        </Button>
      </div>
    </fieldset>
  );
}
