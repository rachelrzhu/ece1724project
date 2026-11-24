"use client";

import {
  Button,
  Fieldset,
  Form,
  Input,
  Label,
  Link,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { saveRecipe, uploadCover } from "@/app/actions";
import type { RecipeDetailData } from "@/lib/product/queries";
import IngredientFields from "./ingredient-fields";

const emptyIngredient = { id: "first", name: "", quantity: null, unit: null, note: null };
const maxRows = 100;

export default function RecipeEditor({ recipe }: { recipe?: RecipeDetailData }) {
  const router = useRouter();
  const formId = useId();
  const nextRow = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [coverId, setCoverId] = useState(recipe?.coverFileId ?? null);
  const [saving, setSaving] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const pending = saving || navigating;
  const [error, setError] = useState("");
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? [emptyIngredient]);
  const [steps, setSteps] = useState(recipe?.steps ?? [{ id: "first", instruction: "" }]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const file = fileInput.current?.files?.[0];
    setSaving(true);
    setError("");
    try {
      const input = {
        title: data.get("title"),
        description: data.get("description"),
        baseServings: Number(data.get("baseServings")),
        prepMinutes: Number(data.get("prepMinutes")),
        cookMinutes: Number(data.get("cookMinutes")),
        difficulty: data.get("difficulty"),
        visibility: data.get("visibility"),
        ingredients: ingredients.map(({ id }) => {
          const prefix = `ingredient-${id}`;
          const quantity = data.get(`${prefix}-quantity`);
          return {
            name: data.get(`${prefix}-name`),
            quantity: quantity ? Number(quantity) : null,
            unit: String(data.get(`${prefix}-unit`) ?? "").trim() || null,
            note: String(data.get(`${prefix}-note`) ?? "").trim() || null,
          };
        }),
        steps: steps.map(({ id }) => ({ instruction: data.get(`step-${id}`) })),
        coverFileId: coverId,
      };
      if (file) {
        if (file.size === 0 || file.size > 3 * 1024 * 1024) {
          setError("Choose a nonempty cover image up to 3 MiB.");
          return;
        }
        const upload = new FormData();
        upload.set("file", file);
        const result = await uploadCover(upload);
        if (result.error !== undefined) {
          setError(result.error);
          return;
        }
        input.coverFileId = result.id;
        setCoverId(result.id);
        if (fileInput.current) fileInput.current.value = "";
      }
      const result = await saveRecipe(recipe?.id ?? null, input);
      if (result.error !== undefined) {
        const details = result.fields?.map(({ path, message }) => `${path}: ${message}`);
        setError(details?.join(" · ") || result.error);
      } else {
        startNavigation(() => router.replace(`/recipes/${result.id}`));
      }
    } catch {
      setError("Couldn’t reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form onSubmit={submit} aria-label={recipe ? "Edit recipe" : "Create recipe"}>
      <fieldset className="grid min-w-0 gap-6" disabled={pending} aria-label="Recipe fields">
        <TextField name="title" defaultValue={recipe?.title} fullWidth isRequired>
          <Label>Title</Label>
          <Input maxLength={160} />
        </TextField>
        <TextField name="description" defaultValue={recipe?.description} fullWidth isRequired>
          <Label>Description</Label>
          <TextArea rows={2} maxLength={5000} />
        </TextField>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <Label htmlFor={`${formId}-servings`}>Base servings</Label>
            <Input
              id={`${formId}-servings`}
              name="baseServings"
              type="number"
              min="0.0001"
              max="10000"
              step="0.0001"
              defaultValue={recipe?.baseServings ?? 1}
              fullWidth
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${formId}-prep`}>Preparation minutes</Label>
            <Input
              id={`${formId}-prep`}
              name="prepMinutes"
              type="number"
              min="0"
              max="10080"
              defaultValue={recipe?.prepMinutes ?? 0}
              fullWidth
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${formId}-cook`}>Cooking minutes</Label>
            <Input
              id={`${formId}-cook`}
              name="cookMinutes"
              type="number"
              min="0"
              max="10080"
              defaultValue={recipe?.cookMinutes ?? 0}
              fullWidth
              required
            />
          </div>
        </div>
        <RadioGroup
          name="difficulty"
          orientation="horizontal"
          defaultValue={recipe?.difficulty ?? "EASY"}
        >
          <Label>Difficulty</Label>
          {["EASY", "MEDIUM", "HARD"].map((option) => (
            <Radio key={option} value={option}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Label>{option.charAt(0) + option.slice(1).toLowerCase()}</Label>
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <RadioGroup
          name="visibility"
          orientation="horizontal"
          defaultValue={recipe?.visibility ?? "PRIVATE"}
        >
          <Label>Visibility</Label>
          {["PRIVATE", "PUBLIC"].map((option) => (
            <Radio key={option} value={option}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Label>{option.charAt(0) + option.slice(1).toLowerCase()}</Label>
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <Fieldset>
          <Fieldset.Legend>Ingredients</Fieldset.Legend>
          <p>
            Enter a quantity and unit, or leave the quantity blank and add a note such as “to
            taste”.
          </p>
          {ingredients.map((ingredient, index) => (
            <IngredientFields
              key={ingredient.id}
              ingredient={ingredient}
              number={index + 1}
              canRemove={ingredients.length > 1}
              onRemove={() =>
                setIngredients((rows) => rows.filter((row) => row.id !== ingredient.id))
              }
            />
          ))}
          <div>
            <Button
              type="button"
              variant="secondary"
              isDisabled={ingredients.length >= maxRows}
              onPress={() => {
                const id = `new-${nextRow.current++}`;
                setIngredients((rows) => [...rows, { ...emptyIngredient, id }]);
              }}
            >
              Add ingredient
            </Button>
          </div>
        </Fieldset>
        <Fieldset>
          <Fieldset.Legend>Steps</Fieldset.Legend>
          {steps.map((step, index) => (
            <div key={step.id} className="grid gap-2">
              <TextField
                name={`step-${step.id}`}
                defaultValue={step.instruction}
                fullWidth
                isRequired
              >
                <Label>Step {index + 1}</Label>
                <TextArea rows={2} maxLength={4000} />
              </TextField>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isDisabled={steps.length === 1}
                  aria-label={`Remove step ${index + 1}`}
                  onPress={() => setSteps((rows) => rows.filter((row) => row.id !== step.id))}
                >
                  Remove step
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="secondary"
              isDisabled={steps.length >= maxRows}
              onPress={() => {
                const id = `new-${nextRow.current++}`;
                setSteps((rows) => [...rows, { id, instruction: "" }]);
              }}
            >
              Add step
            </Button>
          </div>
        </Fieldset>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-cover`}>Cover image (JPEG, PNG or WebP, up to 3 MiB)</Label>
          <Input
            id={`${formId}-cover`}
            type="file"
            ref={fileInput}
            className="min-w-0 max-w-full"
            fullWidth
            accept="image/jpeg,image/png,image/webp"
          />
          {coverId && (
            <Link href={`/api/images/${coverId}`} target="_blank" rel="noreferrer">
              View current cover
            </Link>
          )}
          <div>
            <Button
              type="button"
              variant="secondary"
              onPress={() => {
                setCoverId(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              Remove cover
            </Button>
          </div>
        </div>
        <div>
          <Button type="submit" isDisabled={pending}>
            {pending ? "Saving…" : "Save recipe"}
          </Button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </Form>
  );
}
