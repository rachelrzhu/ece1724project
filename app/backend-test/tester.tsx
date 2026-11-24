"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import styles from "./tester.module.css";

type Recipe = {
  id: string; title: string; baseServings: string; coverFileId: string | null;
  description?: string; prepMinutes?: number; cookMinutes?: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD"; visibility?: "PRIVATE" | "PUBLIC";
  ingredients?: { name: string; quantity: string | null; unit: string | null; note: string | null }[];
  steps?: { instruction: string }[];
};
type IngredientRow = { key: number; name: string; quantity: string; unit: string; note: string };
type Reply = { recipes?: Recipe[]; recipe?: Recipe; image?: { id: string }; error?: string };
const defaults = { title: "Test recipe", servings: "4", step: "Mix and bake." };
const defaultIngredient: IngredientRow = { key: 0, name: "Flour", quantity: "400", unit: "g", note: "" };
const recipesUrl = "/api/backend-test/recipes";
const imagesUrl = "/api/backend-test/images";

export default function BackendTester() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState("");
  const [fields, setFields] = useState(defaults);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([defaultIngredient]);
  const [loadedRecipe, setLoadedRecipe] = useState<Recipe | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState("No request yet.");
  const fileInput = useRef<HTMLInputElement>(null);
  const nextIngredientKey = useRef(1);

  async function refresh() {
    const reply = await fetch(recipesUrl, { cache: "no-store" });
    const data: Reply = await reply.json();
    if (!reply.ok) throw new Error(data.error ?? "Could not list recipes.");
    setRecipes(data.recipes ?? []);
  }

  async function request(url: string, options?: RequestInit): Promise<Reply> {
    const reply = await fetch(url, { ...options, cache: "no-store" });
    const data: Reply = await reply.json();
    setResponse(`${options?.method ?? "GET"} ${url} → ${reply.status}\n${JSON.stringify(data, null, 2)}`);
    if (!reply.ok) throw new Error(data.error ?? "Request failed.");
    return data;
  }
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError("");
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }
  function showRecipe(recipe: Recipe) {
    setSelected(recipe.id); setImageId(recipe.coverFileId);
    setLoadedRecipe(recipe);
    setFields({ title: recipe.title, servings: recipe.baseServings,
      step: recipe.steps?.[0]?.instruction ?? "" });
    setIngredients(recipe.ingredients?.map((ingredient) => ({ key: nextIngredientKey.current++, name: ingredient.name,
      quantity: ingredient.quantity ?? "", unit: ingredient.unit ?? "", note: ingredient.note ?? "" })) ?? [defaultIngredient]);
  }
  async function save(method: "POST" | "PATCH") {
    const data = await request(method === "POST" ? recipesUrl : `${recipesUrl}?id=${selected}`, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: fields.title, description: loadedRecipe?.description ?? "Backend integration test recipe.", baseServings: Number(fields.servings),
        prepMinutes: loadedRecipe?.prepMinutes ?? 0, cookMinutes: loadedRecipe?.cookMinutes ?? 0,
        difficulty: loadedRecipe?.difficulty ?? "EASY", visibility: loadedRecipe?.visibility ?? "PRIVATE", coverFileId: imageId,
        ingredients: ingredients.map(({ name, quantity, unit, note }) => ({ name, quantity: quantity.trim() === "" ? null : Number(quantity), unit: unit.trim() || null, note: note.trim() || null })),
        steps: [{ instruction: fields.step }, ...(loadedRecipe?.steps?.slice(1).map(({ instruction }) => ({ instruction })) ?? [])] }),
    });
    if (data.recipe) showRecipe(data.recipe);
    await refresh();
  }
  function submitRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => save(selected ? "PATCH" : "POST"));
  }
  function field(key: keyof typeof defaults, value: string) { setFields((current) => ({ ...current, [key]: value })); }
  function ingredientField(key: number, field: Exclude<keyof IngredientRow, "key">, value: string) {
    setIngredients((current) => current.map((ingredient) => ingredient.key === key ? { ...ingredient, [field]: value } : ingredient));
  }
  function addIngredient() {
    const row: IngredientRow = { key: nextIngredientKey.current++, name: "", quantity: "", unit: "", note: "" };
    setIngredients((current) => [...current, row]);
  }

  return <main className={styles.page}>
    <h1>Backend test</h1>
    <p>Temporary local test page. Add or remove ingredient rows as needed.</p>
    <p>Uses a dedicated test database schema and a fixed test user. Click Refresh / read to load saved recipes.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={busy}>
      <legend>Saved recipes</legend>
      <label>Recipe
        <select value={selected} onChange={(event) => {
          const id = event.target.value;
          if (!id) { setSelected(""); setFields(defaults); setIngredients([defaultIngredient]); setLoadedRecipe(null); setImageId(null); return; }
          void run(async () => { const data = await request(`${recipesUrl}?id=${id}`); if (data.recipe) showRecipe(data.recipe); });
        }}>
          <option value="">New recipe</option>
          {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void run(async () => { const data = await request(recipesUrl); setRecipes(data.recipes ?? []); })}>Refresh / read</button>
    </fieldset>

    <form onSubmit={submitRecipe}>
      <fieldset disabled={busy}>
        <legend>Recipe</legend>
        <label>Title<input required maxLength={160} value={fields.title} onChange={(event) => field("title", event.target.value)} /></label>
        <label>Servings<input required type="number" min="0.0001" max="10000" step="0.0001" value={fields.servings} onChange={(event) => field("servings", event.target.value)} /></label>
        <h2>Ingredients</h2>
        {ingredients.map((ingredient, index) => <div key={ingredient.key} className={styles.ingredientRow}>
          <label className={styles.ingredientName}>Ingredient {index + 1}<input required maxLength={160} value={ingredient.name} onChange={(event) => ingredientField(ingredient.key, "name", event.target.value)} /></label>
          <label>Quantity<input aria-label={`Quantity ${index + 1}`} type="number" min="0.000001" max="1000000" step="0.000001" value={ingredient.quantity} onChange={(event) => ingredientField(ingredient.key, "quantity", event.target.value)} /></label>
          <label>Unit<input aria-label={`Unit ${index + 1}`} required={ingredient.quantity.trim() !== ""} maxLength={32} value={ingredient.unit} onChange={(event) => ingredientField(ingredient.key, "unit", event.target.value)} /></label>
          <button type="button" className={styles.removeIngredient} aria-label={`Remove ingredient ${index + 1}`} disabled={ingredients.length === 1} onClick={() => setIngredients((current) => current.filter((row) => row.key !== ingredient.key))}>Remove</button>
          <label className={styles.ingredientNote}>Note<input aria-label={`Note ${index + 1}`} required={ingredient.quantity.trim() === ""} maxLength={300} value={ingredient.note} placeholder="Optional, or “to taste” when quantity is blank" onChange={(event) => ingredientField(ingredient.key, "note", event.target.value)} /></label>
        </div>)}
        <button type="button" disabled={ingredients.length >= 100} onClick={addIngredient}>Add ingredient</button>
        <p>Leave quantity blank and add a note for ingredients such as salt to taste.</p>
        <label>Step<textarea required maxLength={4000} value={fields.step} onChange={(event) => field("step", event.target.value)} /></label>
        {(loadedRecipe?.steps?.length ?? 0) > 1 && <p>This form edits the first step; additional saved steps are kept unchanged.</p>}
        <div className={styles.buttons}>
          <button type="submit">{selected ? "Update selected" : "Create"}</button>
          <button type="button" disabled={!selected} onClick={() => void run(async () => { await request(`${recipesUrl}?id=${selected}`, { method: "DELETE" }); setSelected(""); setLoadedRecipe(null); await refresh(); })}>Delete selected</button>
        </div>
      </fieldset>
    </form>

    <fieldset disabled={busy}>
      <legend>Image</legend>
      <label>JPEG, PNG, or WebP (up to 3 MiB)<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <div className={styles.buttons}>
        <button type="button" onClick={() => void run(async () => {
          const file = fileInput.current?.files?.[0];
          if (!file) throw new Error("Choose an image first.");
          const form = new FormData(); form.set("image", file);
          const data = await request(imagesUrl, { method: "POST", body: form });
          if (data.image) setImageId(data.image.id);
        })}>Upload image</button>
        <button type="button" disabled={!imageId} onClick={() => void run(async () => { await request(`${imagesUrl}?id=${imageId}`, { method: "DELETE" }); setImageId(null); })}>Delete image</button>
      </div>
      {imageId && <><Image unoptimized src={`${imagesUrl}?id=${imageId}`} alt="Uploaded test image" width={160} height={120} style={{ width: "auto", height: "auto", maxWidth: 160, maxHeight: 120 }} /><p>Image is attached when you create or update the recipe.</p></>}
    </fieldset>
    <h2>Last API response {busy ? "(working…)" : ""}</h2>
    <pre className={styles.output} aria-live="polite">{response}</pre>
  </main>;
}
