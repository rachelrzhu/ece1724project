"use client";

import { Button, ButtonLink, Input, Textarea } from "@/app/_components/material";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { saveRecipe, uploadCover } from "@/app/actions";
import type { RecipeDetailData } from "@/lib/product/queries";
import { isValidBaseServings, MAX_SERVINGS, formatScaledQuantity } from "@/lib/recipes/measurements";
import { recipeEditSchema, recipeInputSchema } from "@/lib/recipes/schemas";
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

export default function RecipeEditor({ recipe, units }: { recipe?: RecipeDetailData; units: string[] }) {
  const router = useRouter();
  const formId = useId();
  const nextRow = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [coverId, setCoverId] = useState(recipe?.coverFileId ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [keepServings, setKeepServings] = useState(!!recipe && !isValidBaseServings(Number(recipe.baseServings)));
  const [saving, setSaving] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? [emptyIngredient]);
  const [steps, setSteps] = useState(recipe?.steps ?? [{ id: "first", instruction: "" }]);
  const pending = saving || navigating;
  const cancelHref = recipe ? `/recipes/${recipe.id}` : "/recipes?collection=mine";

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
    const parsed = (recipe ? recipeEditSchema : recipeInputSchema).safeParse({
      title: data.get("title"),
      description: data.get("description"),
      baseServings: keepServings ? "original" : Number(data.get("baseServings")),
      prepMinutes: Number(data.get("prepMinutes")),
      cookMinutes: Number(data.get("cookMinutes")),
      difficulty: data.get("difficulty"),
      visibility: data.get("visibility"),
      ingredients: ingredients.map(({ id }) => {
        const prefix = `ingredient-${id}`;
        const quantity = data.get(`${prefix}-quantity`);
        const stored = data.get(`${prefix}-stored`);
        return {
          name: data.get(`${prefix}-name`),
          quantity: stored ? { fromIngredientId: stored } : quantity ? Number(quantity) : null,
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
    const knownType = file.type && file.type !== "application/octet-stream";
    if (file.size === 0 || file.size > maxPhotoBytes || (knownType && !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      clearSelection();
      setFeedback({ message: "Choose a still JPEG, PNG, or WebP image up to 3 MiB." });
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form onSubmit={submit} aria-label={recipe ? "Edit recipe" : "Create recipe"} className="max-w-3xl">
      {feedback && (
        <div ref={feedbackRef} tabIndex={-1} role="alert" className="mb-4 w-full rounded-md border border-red-200 bg-red-50 p-4 text-rust">
          <p className="font-semibold">{feedback.message}</p>
          {!!feedback.fields?.length && (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
              {feedback.fields.map(({ path, message }, index) => <li key={`${path}-${index}`}>{issueLabel(path)}. {message}</li>)}
            </ul>
          )}
        </div>
      )}
      <fieldset className="grid w-full min-w-0 gap-6" disabled={pending} aria-label="Recipe fields">
        <section className="grid min-w-0 gap-4 border-t border-line pt-5" aria-labelledby="recipe-basics">
          <h2 id="recipe-basics" className="site-heading text-xl">Recipe details</h2>
          <div className="grid gap-1">
            <label htmlFor={`${formId}-title`}>Title</label>
            <Input id={`${formId}-title`} name="title" defaultValue={recipe?.title} className="min-h-11 text-base" maxLength={160} required />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${formId}-description`}>Description</label>
            <Textarea id={`${formId}-description`} name="description" defaultValue={recipe?.description}
              className="text-base" rows={3} maxLength={5000} resize required />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: "baseServings", label: "Base servings", min: "1", max: String(MAX_SERVINGS), step: "1", initial: recipe && !isValidBaseServings(Number(recipe.baseServings)) ? "" : recipe?.baseServings ?? 1 },
              { name: "prepMinutes", label: "Prep time (min)", min: "0", max: "10080", step: "1", initial: recipe?.prepMinutes ?? 0 },
              { name: "cookMinutes", label: "Cook time (min)", min: "0", max: "10080", step: "1", initial: recipe?.cookMinutes ?? 0 },
            ].map(({ name, label, initial, ...bounds }) => (
              <div key={name} className="grid min-w-0 gap-1">
                <label htmlFor={`${formId}-${name}`}>{label}</label>
                {name === "baseServings" && keepServings ? (
                  <Button id={`${formId}-${name}`} type="button" variant="outline" onClick={() => setKeepServings(false)}>
                    Change original servings ({formatScaledQuantity(Number(recipe?.baseServings))})
                  </Button>
                ) : (
                  <Input id={`${formId}-${name}`} name={name} type="number" defaultValue={initial}
                    className="min-h-11 text-base" required {...bounds} />
                )}
              </div>
            ))}
          </div>
          <fieldset role="radiogroup">
            <legend>Difficulty</legend>
            <div className="flex flex-wrap gap-x-5">
              {["EASY", "MEDIUM", "HARD"].map((option) => (
                <label key={option} className="inline-flex min-h-11 items-center gap-2 capitalize">
                  <input type="radio" name="difficulty" value={option} defaultChecked={option === (recipe?.difficulty ?? "EASY")}
                    className="size-4 accent-brand" />
                  {option.toLowerCase()}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="grid min-w-0 gap-4 border-t border-line pt-5" aria-labelledby="recipe-ingredients">
          <div className="space-y-1">
            <h2 id="recipe-ingredients" className="site-heading text-xl">Ingredients</h2>
            <p className="text-sm text-subtle">Use a quantity and unit for measured ingredients. For unmeasured ingredients, add a note such as “to taste”.</p>
          </div>
          {ingredients.map((ingredient, index) => (
            <IngredientFields key={ingredient.id} ingredient={ingredient} number={index + 1} units={units}
              canRemove={ingredients.length > 1}
              onRemove={() => setIngredients((rows) => rows.filter((row) => row.id !== ingredient.id))} />
          ))}
          <Button type="button" variant="outline" className="min-h-11 justify-self-start"
            disabled={ingredients.length >= maxRows} onClick={() => {
              const id = `new-${nextRow.current++}`;
              setIngredients((rows) => [...rows, { ...emptyIngredient, id }]);
            }}>
            Add ingredient
          </Button>
        </section>

        <section className="grid min-w-0 gap-4 border-t border-line pt-5" aria-labelledby="recipe-method">
          <h2 id="recipe-method" className="site-heading text-xl">Method</h2>
          {steps.map((step, index) => (
            <div key={step.id} className="grid min-w-0 gap-2">
              <div className="grid gap-1">
                <label htmlFor={`${formId}-step-${step.id}`}>Step {index + 1}</label>
                <Textarea id={`${formId}-step-${step.id}`} name={`step-${step.id}`} defaultValue={step.instruction}
                  className="text-base" rows={2} maxLength={4000} resize required />
              </div>
              <Button type="button" variant="ghost" size="sm" className="justify-self-start"
                disabled={steps.length === 1} aria-label={`Remove step ${index + 1}`}
                onClick={() => setSteps((rows) => rows.filter((row) => row.id !== step.id))}>
                Remove step
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="min-h-11 justify-self-start"
            disabled={steps.length >= maxRows} onClick={() => {
              const id = `new-${nextRow.current++}`;
              setSteps((rows) => [...rows, { id, instruction: "" }]);
            }}>
            Add step
          </Button>
        </section>

        <section className="grid min-w-0 gap-4 border-t border-line pt-5" aria-labelledby="recipe-photo">
          <h2 id="recipe-photo" className="site-heading text-xl">Cover photo</h2>
          {(preview || coverId) && (
            preview ? (
              <div className="relative aspect-[16/10] w-full max-w-xs overflow-hidden rounded-md border border-line">
                <Image src={preview} alt="Selected cover preview" fill unoptimized className="object-cover" />
              </div>
            ) : (
              <RecipeCover fileId={coverId} className="aspect-[16/10] w-full max-w-xs rounded-md border border-line" />
            )
          )}
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor={`${formId}-cover`}>Choose a photo (optional)</label>
            <input id={`${formId}-cover`} type="file" ref={fileInput}
              className="site-field w-full py-2 file:me-2 file:rounded-md file:border-0 file:bg-canvas file:px-2 file:py-0.5 file:text-ink"
              accept="image/jpeg,image/png,image/webp" aria-describedby={`${formId}-cover-help`}
              onChange={(event) => chooseCover(event.currentTarget.files?.[0])} />
            <p id={`${formId}-cover-help`} className="text-sm text-subtle">JPEG, PNG, or WebP up to 3 MiB.</p>
          </div>
          {(preview || coverId) && (
            <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => {
              if (!preview) setCoverId(null);
              clearSelection();
            }}>
              {preview ? "Clear selected photo" : "Remove cover photo"}
            </Button>
          )}
        </section>

        <section className="grid min-w-0 gap-4 border-t border-line pt-5" aria-labelledby="recipe-publishing">
          <h2 id="recipe-publishing" className="site-heading text-xl">Visibility</h2>
          <div role="radiogroup" aria-labelledby="recipe-publishing" className="grid gap-2">
            {[
              { value: "PRIVATE", label: "Private", detail: "Only you can view this recipe." },
              { value: "PUBLIC", label: "Public", detail: "Anyone can find, view, and bookmark this recipe." },
            ].map(({ value, label, detail }) => (
              <label key={value} className="flex min-h-11 items-start gap-2.5">
                <input type="radio" name="visibility" value={value} defaultChecked={value === (recipe?.visibility ?? "PRIVATE")}
                  className="mt-1 size-4 shrink-0 accent-brand" aria-labelledby={`${formId}-${value}-label`}
                  aria-describedby={`${formId}-${value}-hint`} />
                <span>
                  <span id={`${formId}-${value}-label`}>{label}</span>
                  <span id={`${formId}-${value}-hint`} className="block text-sm text-subtle">{detail}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <Button type="submit" className="min-h-11" disabled={pending}>{pending ? "Saving…" : "Save recipe"}</Button>
          <ButtonLink href={cancelHref} variant="outline" className="min-h-11">Cancel</ButtonLink>
        </div>
      </fieldset>
    </form>
  );
}
