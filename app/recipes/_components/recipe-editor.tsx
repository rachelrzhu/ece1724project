"use client";

import { Button, Form, Input, Label, Radio, RadioGroup, TextArea, TextField } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { saveRecipe, uploadCover } from "@/app/actions";
import type { RecipeDetailData } from "@/lib/product/queries";
import { recipeInputSchema } from "@/lib/recipes/schemas";
import IngredientFields from "./ingredient-fields";

const emptyIngredient = { id: "first", name: "", quantity: null, unit: null, note: null };
const maxRows = 100;
const maxPhotoBytes = 3 * 1024 * 1024;
const fieldLabels: Record<string, string> = {
  title: "Title", description: "Description", baseServings: "Base servings",
  prepMinutes: "Prep time", cookMinutes: "Cook time", difficulty: "Difficulty", visibility: "Visibility",
  name: "name", quantity: "quantity", unit: "unit", note: "note", coverFileId: "Cover photo",
};

type FieldIssue = { path: string; message: string };
type EditorFeedback = { message: string; fields?: FieldIssue[] };

function issueLabel(path: string) {
  const [section, index, field] = path.split(".");
  if (section === "ingredients" && index !== undefined) return `Ingredient ${Number(index) + 1} ${fieldLabels[field] ?? ""}`.trim();
  if (section === "steps" && index !== undefined) return `Step ${Number(index) + 1}`;
  return fieldLabels[section] ?? "Recipe";
}

export default function RecipeEditor({ recipe }: { recipe?: RecipeDetailData }) {
  const router = useRouter();
  const formId = useId();
  const nextRow = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [coverId, setCoverId] = useState(recipe?.coverFileId ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? [emptyIngredient]);
  const [steps, setSteps] = useState(recipe?.steps ?? [{ id: "first", instruction: "" }]);
  const pending = saving || navigating;
  const cancelHref = recipe ? `/recipes/${recipe.id}` : "/?collection=mine";

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clearSelection() {
    if (fileInput.current) fileInput.current.value = "";
    setPreview(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const file = fileInput.current?.files?.[0];
    const parsed = recipeInputSchema.safeParse({
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
    });

    if (!parsed.success) {
      setFeedback({
        message: "Check the following recipe details.",
        fields: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const input = parsed.data;
      if (file) {
        const upload = new FormData();
        upload.set("file", file);
        const result = await uploadCover(upload);
        if (result.error !== undefined) {
          setFeedback({ message: result.error });
          return;
        }
        input.coverFileId = result.id;
        setCoverId(result.id);
        clearSelection();
      }

      const result = await saveRecipe(recipe?.id ?? null, input);
      if (result.error !== undefined) {
        setFeedback({ message: result.error, fields: result.fields });
      } else {
        startNavigation(() => router.replace(`/recipes/${result.id}`));
      }
    } catch {
      setFeedback({ message: "Couldn’t reach the server. Try again." });
    } finally {
      setSaving(false);
    }
  }

  function chooseCover(file: File | undefined) {
    setFeedback(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (file.size === 0 || file.size > maxPhotoBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      clearSelection();
      setFeedback({ message: "Choose a still JPEG, PNG, or WebP image up to 3 MiB." });
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <Form onSubmit={submit} aria-label={recipe ? "Edit recipe" : "Create recipe"} className="max-w-5xl">
      {feedback && (
        <div ref={feedbackRef} tabIndex={-1} role="alert" className="mb-4 w-full rounded-xl border border-red-200 bg-red-50 p-4 text-rust">
          <p className="font-semibold">{feedback.message}</p>
          {!!feedback.fields?.length && (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
              {feedback.fields.map(({ path, message }, index) => <li key={`${path}-${index}`}>{issueLabel(path)}. {message}</li>)}
            </ul>
          )}
        </div>
      )}
      <fieldset className="grid w-full min-w-0 gap-5" disabled={pending} aria-label="Recipe fields">
        <section className="site-panel grid gap-4 border-t-2 border-t-brand" aria-labelledby="recipe-basics">
          <h2 id="recipe-basics" className="site-heading text-2xl">Recipe details</h2>
          <TextField name="title" defaultValue={recipe?.title} fullWidth isRequired>
            <Label>Title</Label>
            <Input className="site-field" maxLength={160} />
          </TextField>
          <TextField name="description" defaultValue={recipe?.description} fullWidth isRequired>
            <Label>Description</Label>
            <TextArea className="site-field py-2" rows={3} maxLength={5000} />
          </TextField>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: "baseServings", label: "Base servings", min: "0.0001", max: "10000", step: "0.0001", initial: recipe?.baseServings ?? 1 },
              { name: "prepMinutes", label: "Prep time (min)", min: "0", max: "10080", step: "1", initial: recipe?.prepMinutes ?? 0 },
              { name: "cookMinutes", label: "Cook time (min)", min: "0", max: "10080", step: "1", initial: recipe?.cookMinutes ?? 0 },
            ].map(({ name, label, initial, ...bounds }) => (
              <div key={name} className="grid min-w-0 gap-1">
                <Label htmlFor={`${formId}-${name}`}>{label}</Label>
                <Input id={`${formId}-${name}`} name={name} type="number" defaultValue={initial}
                  className="site-field" fullWidth required {...bounds} />
              </div>
            ))}
          </div>
          <RadioGroup name="difficulty" orientation="horizontal" defaultValue={recipe?.difficulty ?? "EASY"}>
            <Label>Difficulty</Label>
            {["EASY", "MEDIUM", "HARD"].map((option) => (
              <Radio key={option} value={option}>
                <Radio.Content>
                  <Radio.Control><Radio.Indicator /></Radio.Control>
                  <Label className="capitalize">{option.toLowerCase()}</Label>
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </section>

        <section className="site-panel grid gap-4 border-t-2 border-t-brand" aria-labelledby="recipe-ingredients">
          <div className="space-y-1">
            <h2 id="recipe-ingredients" className="site-heading text-2xl">Ingredients</h2>
            <p className="text-sm text-subtle">Use a quantity and unit for measured ingredients. For unmeasured ingredients, add a note such as “to taste”.</p>
          </div>
          {ingredients.map((ingredient, index) => (
            <IngredientFields key={ingredient.id} ingredient={ingredient} number={index + 1}
              canRemove={ingredients.length > 1}
              onRemove={() => setIngredients((rows) => rows.filter((row) => row.id !== ingredient.id))} />
          ))}
          <Button type="button" variant="secondary" className="site-button-outline justify-self-start"
            isDisabled={ingredients.length >= maxRows} onPress={() => {
              const id = `new-${nextRow.current++}`;
              setIngredients((rows) => [...rows, { ...emptyIngredient, id }]);
            }}>
            Add ingredient
          </Button>
        </section>

        <section className="site-panel grid gap-4 border-t-2 border-t-brand" aria-labelledby="recipe-method">
          <h2 id="recipe-method" className="site-heading text-2xl">Method</h2>
          {steps.map((step, index) => (
            <div key={step.id} className="grid min-w-0 gap-2 rounded-xl border border-line bg-canvas p-3 sm:p-4">
              <TextField name={`step-${step.id}`} defaultValue={step.instruction} fullWidth isRequired>
                <Label>Step {index + 1}</Label>
                <TextArea className="site-field py-2" rows={2} maxLength={4000} />
              </TextField>
              <Button type="button" variant="ghost" size="sm" className="justify-self-start"
                isDisabled={steps.length === 1} aria-label={`Remove step ${index + 1}`}
                onPress={() => setSteps((rows) => rows.filter((row) => row.id !== step.id))}>
                Remove step
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" className="site-button-outline justify-self-start"
            isDisabled={steps.length >= maxRows} onPress={() => {
              const id = `new-${nextRow.current++}`;
              setSteps((rows) => [...rows, { id, instruction: "" }]);
            }}>
            Add step
          </Button>
        </section>

        <section className="site-panel grid gap-4 border-t-2 border-t-brand" aria-labelledby="recipe-photo">
          <h2 id="recipe-photo" className="site-heading text-2xl">Cover photo</h2>
          {(preview || coverId) && (
            preview ? (
              <div className="relative aspect-[16/10] w-full max-w-xs overflow-hidden rounded-xl border border-line">
                <Image src={preview} alt="Selected cover preview" fill unoptimized className="object-cover" />
              </div>
            ) : (
              <RecipeCover fileId={coverId} className="aspect-[16/10] w-full max-w-xs rounded-xl border border-line" />
            )
          )}
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={`${formId}-cover`}>Choose a photo (optional)</Label>
            <Input id={`${formId}-cover`} type="file" ref={fileInput}
              className="max-w-full file:me-2 file:rounded-md file:border-0 file:bg-tint file:px-2 file:py-0.5 file:text-brand"
              fullWidth accept="image/jpeg,image/png,image/webp" aria-describedby={`${formId}-cover-help`}
              onChange={(event) => chooseCover(event.currentTarget.files?.[0])} />
            <p id={`${formId}-cover-help`} className="text-sm text-subtle">JPEG, PNG, or WebP up to 3 MiB.</p>
          </div>
          {(preview || coverId) && (
            <Button type="button" variant="secondary" className="site-button-outline justify-self-start" onPress={() => {
              if (!preview) setCoverId(null);
              clearSelection();
            }}>
              {preview ? "Clear selected photo" : "Remove cover photo"}
            </Button>
          )}
        </section>

        <section className="site-panel grid gap-4 border-t-2 border-t-brand" aria-labelledby="recipe-publishing">
          <h2 id="recipe-publishing" className="site-heading text-2xl">Visibility</h2>
          <RadioGroup name="visibility" aria-labelledby="recipe-publishing" defaultValue={recipe?.visibility ?? "PRIVATE"}>
            {[
              { value: "PRIVATE", label: "Private", detail: "Only you can view this recipe." },
              { value: "PUBLIC", label: "Public", detail: "Anyone can find, view, and bookmark this recipe." },
            ].map(({ value, label, detail }) => (
              <Radio key={value} value={value}>
                <Radio.Content>
                  <Radio.Control><Radio.Indicator /></Radio.Control>
                  <div className="space-y-1"><Label>{label}</Label><p className="text-sm text-subtle">{detail}</p></div>
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </section>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="site-button" isDisabled={pending}>{pending ? "Saving…" : "Save recipe"}</Button>
          <Link href={cancelHref} className="site-button-outline">Cancel</Link>
        </div>
      </fieldset>
    </Form>
  );
}
