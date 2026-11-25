import { editorText } from "@/lib/i18n/editor";
import { useLocale } from "@/app/_components/language-provider";
import { Button, Input } from "@/app/_components/material";
import { formatScaledQuantity, isValidQuantity, MAX_QUANTITY, MIN_QUANTITY } from "@/lib/recipes/measurements";
import { useState } from "react";
import type { RecipeDetailData } from "@/lib/product/queries";

type Ingredient = RecipeDetailData["ingredients"][number];

export default function IngredientFields({
  ingredient,
  number,
  units,
  canRemove,
  onRemove,
}: {
  ingredient: Ingredient;
  number: number;
  units: string[];
  canRemove: boolean;
  onRemove: () => void;
}) {
  const locale = useLocale();
  const t = editorText(locale);
  const legacy = (ingredient.quantity !== null && !isValidQuantity(Number(ingredient.quantity))) ||
    (ingredient.unit !== null && !units.includes(ingredient.unit));
  const [keepMeasurement, setKeepMeasurement] = useState(legacy);
  const [quantity, setQuantity] = useState(legacy ? "" : ingredient.quantity ?? "");
  const hasQuantity = keepMeasurement ? ingredient.quantity !== null : quantity !== "";
  const prefix = `ingredient-${ingredient.id}`;

  return (
    <fieldset className="min-w-0 rounded-lg border border-line p-3 sm:p-4">
      <legend className="px-1 font-semibold">{t("Ingredient {number}", { number })}</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-name`}>{t("Name")}</label>
          <Input id={`${prefix}-name`} name={`${prefix}-name`} defaultValue={ingredient.name}
            className="min-h-11 text-base" maxLength={160} required />
        </div>
        {keepMeasurement ? (
          <div className="grid gap-1">
            <input type="hidden" name={`${prefix}-stored`} value={ingredient.id} />
            <p>{ingredient.quantity === null ? t("Original measurement")
              : t("Original measurement (about {quantity} {unit})", {
                quantity: formatScaledQuantity(Number(ingredient.quantity), locale), unit: t(ingredient.unit ?? ""),
              })}</p>
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => setKeepMeasurement(false)}>
              {t("Change measurement")}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-1">
              <label htmlFor={`${prefix}-quantity`}>{t("Quantity (optional, up to 1 decimal place)")}</label>
              <Input id={`${prefix}-quantity`} name={`${prefix}-quantity`} type="number" inputMode="decimal"
                className="min-h-11 text-base" min={MIN_QUANTITY} max={MAX_QUANTITY} step="0.1"
                defaultValue={quantity} onChange={(event) => setQuantity(event.currentTarget.value)} />
            </div>
            <div className="grid gap-1">
              <label htmlFor={`${prefix}-unit`}>{t("Unit")}</label>
              <select id={`${prefix}-unit`} name={`${prefix}-unit`} defaultValue={ingredient.unit && units.includes(ingredient.unit) ? ingredient.unit : ""}
                required={hasQuantity} className="site-field min-h-11 text-base">
                <option value="">{t("Choose a unit")}</option>
                {units.map(unit => <option key={unit} value={unit}>{t(unit)}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-note`}>{t("Note")}</label>
          <Input id={`${prefix}-note`} name={`${prefix}-note`} defaultValue={ingredient.note ?? ""}
            required={!hasQuantity} className="min-h-11 text-base" maxLength={300} placeholder={t("e.g. to taste")} />
        </div>
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canRemove}
          aria-label={t("Remove ingredient {number}", { number })}
          onClick={onRemove}
        >
          {t("Remove ingredient")}
        </Button>
      </div>
    </fieldset>
  );
}
