"use client";

import { Button, Form, Input, Label, Radio, RadioGroup, TextArea, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { saveRecipe, uploadCover } from "@/app/actions";
import type { RecipeDetailData } from "@/lib/product/queries";

export default function RecipeEditor({ recipe }: { recipe?: RecipeDetailData }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [coverId, setCoverId] = useState(recipe?.coverFileId ?? null);
  const [saving, setSaving] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const pending = saving || navigating;
  const [error, setError] = useState("");
  const ingredients = recipe?.ingredients.map(({ name, quantity, unit, note }) => ({
    name, quantity: quantity === null ? null : Number(quantity), unit, note,
  })) ?? [{ name: "", quantity: 1, unit: "count", note: null }];
  const steps = recipe?.steps.map(({ instruction }) => ({ instruction })) ?? [{ instruction: "" }];

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
        ingredients: JSON.parse(String(data.get("ingredients"))),
        steps: JSON.parse(String(data.get("steps"))),
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
    } catch (cause) {
      setError(cause instanceof SyntaxError ? "Enter valid JSON for ingredients and steps." : "Couldn’t reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form onSubmit={submit}>
      <fieldset disabled={pending}>
        <TextField name="title" defaultValue={recipe?.title} isRequired>
          <Label>Title</Label><Input maxLength={160} />
        </TextField>
        <TextField name="description" defaultValue={recipe?.description} isRequired>
          <Label>Description</Label><TextArea maxLength={5000} />
        </TextField>
        <div><Label htmlFor="baseServings">Base servings</Label>
          <Input id="baseServings" name="baseServings" type="number" min="0.0001" max="10000" step="0.0001" defaultValue={recipe?.baseServings ?? 1} required />
        </div>
        <div><Label htmlFor="prepMinutes">Preparation minutes</Label>
          <Input id="prepMinutes" name="prepMinutes" type="number" min="0" max="10080" defaultValue={recipe?.prepMinutes ?? 0} required />
        </div>
        <div><Label htmlFor="cookMinutes">Cooking minutes</Label>
          <Input id="cookMinutes" name="cookMinutes" type="number" min="0" max="10080" defaultValue={recipe?.cookMinutes ?? 0} required />
        </div>
        <RadioGroup name="difficulty" defaultValue={recipe?.difficulty ?? "EASY"}>
          <Label>Difficulty</Label>
          {["EASY", "MEDIUM", "HARD"].map(option => <Radio key={option} value={option}>
            <Radio.Content><Radio.Control><Radio.Indicator /></Radio.Control><Label>{option}</Label></Radio.Content>
          </Radio>)}
        </RadioGroup>
        <RadioGroup name="visibility" defaultValue={recipe?.visibility ?? "PRIVATE"}>
          <Label>Visibility</Label>
          {["PRIVATE", "PUBLIC"].map(option => <Radio key={option} value={option}>
            <Radio.Content><Radio.Control><Radio.Indicator /></Radio.Control><Label>{option}</Label></Radio.Content>
          </Radio>)}
        </RadioGroup>
        <TextField name="ingredients" defaultValue={JSON.stringify(ingredients, null, 2)} isRequired>
          <Label>Ingredients (JSON array)</Label><TextArea rows={8} />
        </TextField>
        <TextField name="steps" defaultValue={JSON.stringify(steps, null, 2)} isRequired>
          <Label>Steps (JSON array)</Label><TextArea rows={5} />
        </TextField>
        <div><Label htmlFor="cover">Cover image (JPEG, PNG or WebP, up to 3 MiB)</Label>
          <Input id="cover" type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp" />
        </div>
        {coverId && <p>Cover file {coverId}</p>}
        <Button type="button" onPress={() => {
          setCoverId(null);
          if (fileInput.current) fileInput.current.value = "";
        }}>Remove cover</Button>
        <Button type="submit" isDisabled={pending}>{pending ? "Saving…" : "Save recipe"}</Button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </Form>
  );
}
