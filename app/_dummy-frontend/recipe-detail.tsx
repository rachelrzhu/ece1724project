import { LinkRoot as Link } from "@heroui/react/link";
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/product/queries";
import PageFrame from "./page-frame";
import RecipeActions from "./recipe-actions";
import RecipeEditor from "./recipe-editor";

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const [recipe, options] = await Promise.all([getRecipe(id), searchParams]);
  if (!recipe) notFound();

  if (options.edit === "1") {
    if (!recipe.isOwner) notFound();
    return (
      <PageFrame title="Edit recipe" back={{ href: `/recipes/${id}`, label: "Back to recipe" }}>
        <RecipeEditor recipe={recipe} />
      </PageFrame>
    );
  }

  return (
    <PageFrame title={recipe.title} back={{ href: "/", label: "Back to recipes" }}>
      <p className="whitespace-pre-line wrap-anywhere">{recipe.description}</p>
      <div>
        <p>By {recipe.authorName} · {recipe.visibility.toLowerCase()}</p>
        <p>Serves {recipe.baseServings} · {recipe.difficulty.toLowerCase()}</p>
        <p>Prep {recipe.prepMinutes} min · Cook {recipe.cookMinutes} min</p>
        {recipe.coverFileId && <Link href={`/api/images/${recipe.coverFileId}`}>View cover photo</Link>}
      </div>
      <section>
        <h2 className="text-lg font-semibold">Ingredients</h2>
        <ul className="list-disc space-y-1 ps-6 wrap-anywhere">
          {recipe.ingredients.map((item) => (
            <li key={item.id}>{[item.quantity, item.unit, item.name, item.note].filter(Boolean).join(" ")}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Steps</h2>
        <ol className="list-decimal space-y-1 ps-6 wrap-anywhere">
          {recipe.steps.map((step) => <li key={step.id}>{step.instruction}</li>)}
        </ol>
      </section>
      {recipe.signedIn && (
        <div className="flex flex-wrap items-center gap-3">
          {recipe.isOwner && <Link href={`/recipes/${id}?edit=1`}>Edit recipe</Link>}
          <RecipeActions
            id={id}
            title={recipe.title}
            saved={recipe.saved}
            isOwner={recipe.isOwner}
            afterDeleteHref="/?collection=mine"
          />
        </div>
      )}
    </PageFrame>
  );
}
