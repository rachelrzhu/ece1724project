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
    <Fieldset>
      <Fieldset.Legend>Ingredient {number}</Fieldset.Legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name={`${prefix}-name`} defaultValue={ingredient.name} fullWidth isRequired>
          <Label>Name</Label>
          <Input maxLength={160} />
        </TextField>
        <div className="grid gap-1">
          <Label htmlFor={quantityId}>Quantity (optional)</Label>
          <Input
            id={quantityId}
            name={`${prefix}-quantity`}
            type="number"
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
          <Input maxLength={32} placeholder="e.g. cup or count" />
        </TextField>
        <TextField
          name={`${prefix}-note`}
          defaultValue={ingredient.note ?? ""}
          fullWidth
          isRequired={!hasQuantity}
        >
          <Label>Note</Label>
          <Input maxLength={300} placeholder="e.g. to taste" />
        </TextField>
      </div>
      <div>
        <Button
          type="button"
          variant="secondary"
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
