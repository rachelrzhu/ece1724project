import { LinkRoot as Link } from "@heroui/react/link";
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/product/queries";
import RecipeEditor from "./recipe-editor";
import RecipeActions from "./recipe-actions";

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const [recipe, options] = await Promise.all([getRecipe(id), searchParams]);
  if (!recipe) notFound();

  if (options.edit === "1") {
    if (!recipe.isOwner) notFound();
    return (
      <main>
        <Link href={`/recipes/${id}`}>Back to recipe</Link>
        <h1>Edit recipe</h1>
        <RecipeEditor recipe={recipe} />
      </main>
    );
  }

  return (
    <main>
      <Link href="/">Back to recipes</Link>
      <h1>{recipe.title}</h1>
      <p>{recipe.description}</p>
      <p>Author: {recipe.authorName}</p>
      <p>Visibility: {recipe.visibility.toLowerCase()}</p>
      <p>Difficulty: {recipe.difficulty.toLowerCase()}</p>
      <p>Servings: {recipe.baseServings}</p>
      <p>Prep: {recipe.prepMinutes} min. Cook: {recipe.cookMinutes} min.</p>
      {recipe.coverFileId && <Link href={`/api/images/${recipe.coverFileId}`}>View cover photo</Link>}
      <h2>Ingredients</h2>
      <ul>
        {recipe.ingredients.map((item) => (
          <li key={item.id}>{[item.quantity, item.unit, item.name, item.note].filter(Boolean).join(" ")}</li>
        ))}
      </ul>
      <h2>Steps</h2>
      <ol>
        {recipe.steps.map((step, index) => <li key={step.id}>{index + 1}. {step.instruction}</li>)}
      </ol>
      {recipe.isOwner && <p><Link href={`/recipes/${id}?edit=1`}>Edit recipe</Link></p>}
      {recipe.signedIn && <RecipeActions id={id} saved={recipe.saved} isOwner={recipe.isOwner} />}
    </main>
  );
}
