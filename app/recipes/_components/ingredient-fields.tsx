import { Button, Fieldset, Input, Label, TextField } from "@heroui/react";
import { useId, useState } from "react";
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
  const quantityId = useId();
  const [hasQuantity, setHasQuantity] = useState(ingredient.quantity !== null);
  const prefix = `ingredient-${ingredient.id}`;

  return (
    <Fieldset className="min-w-0 rounded-xl border border-line bg-canvas p-3 sm:p-4">
      <Fieldset.Legend className="px-1 font-semibold">Ingredient {number}</Fieldset.Legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <TextField name={`${prefix}-name`} defaultValue={ingredient.name} fullWidth isRequired>
          <Label>Name</Label>
          <Input className="site-field" maxLength={160} />
        </TextField>
        <div className="grid gap-1">
          <Label htmlFor={quantityId}>Quantity (optional)</Label>
          <Input
            id={quantityId}
            name={`${prefix}-quantity`}
            type="number"
            className="site-field"
            fullWidth
            min="0.000001"
            max="1000000"
            step="0.000001"
            defaultValue={ingredient.quantity ?? ""}
            onChange={(event) => setHasQuantity(event.currentTarget.value !== "")}
          />
        </div>
        <TextField
          name={`${prefix}-unit`}
          defaultValue={ingredient.unit ?? ""}
          fullWidth
          isRequired={hasQuantity}
        >
          <Label>Unit</Label>
          <Input className="site-field" maxLength={32} placeholder="e.g. cup or count" />
        </TextField>
        <TextField
          name={`${prefix}-note`}
          defaultValue={ingredient.note ?? ""}
          fullWidth
          isRequired={!hasQuantity}
        >
          <Label>Note</Label>
          <Input className="site-field" maxLength={300} placeholder="e.g. to taste" />
        </TextField>
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isDisabled={!canRemove}
          aria-label={`Remove ingredient ${number}`}
          onPress={onRemove}
        >
          Remove ingredient
        </Button>
      </div>
    </Fieldset>
  );
}
