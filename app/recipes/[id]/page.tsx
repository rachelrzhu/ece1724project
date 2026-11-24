import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageFrame from "@/app/_components/page-frame";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { getRecipe } from "@/lib/product/queries";
import RecipeActions from "../_components/recipe-actions";
import RecipeEditor from "../_components/recipe-editor";

export async function generateMetadata({ params, searchParams }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const [{ id }, options] = await Promise.all([params, searchParams]);
  const recipe = await getRecipe(id).catch(() => null);
  if (recipe?.visibility !== "PUBLIC") return { title: "Recipe", robots: { index: false, follow: false } };
  return { title: options.edit === "1" ? "Edit recipe" : recipe.title };
}

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const [recipe, options] = await Promise.all([getRecipe(id), searchParams]);
  if (!recipe) notFound();

  const href = `/recipes/${id}`;
  if (options.edit === "1") {
    if (!recipe.isOwner) notFound();
    return (
      <PageFrame title="Edit recipe" back={{ href, label: "Back to recipe" }}>
        <RecipeEditor recipe={recipe} />
      </PageFrame>
    );
  }

  return (
    <PageFrame title={recipe.title} back={{ href: "/", label: "Explore recipes" }}>
      <div className="grid gap-6 md:grid-cols-[1fr_1.05fr]">
        <div className="site-panel flex flex-col justify-center gap-5 md:p-8">
          <div className="flex flex-wrap items-center gap-2 text-sm text-subtle">
            <span className="wrap-anywhere">By {recipe.authorName}</span>
            <span className="rounded-full bg-sage px-2.5 py-1 font-semibold text-brand capitalize">{recipe.visibility.toLowerCase()}</span>
          </div>
          <p className="whitespace-pre-line leading-relaxed text-subtle wrap-anywhere">{recipe.description}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Base servings", recipe.baseServings],
              ["Prep", `${recipe.prepMinutes} min`],
              ["Cook", `${recipe.cookMinutes} min`],
              ["Difficulty", recipe.difficulty.toLowerCase()],
            ].map(([label, value]) => (
              <div key={label}><dt className="text-sm text-subtle">{label}</dt><dd className="font-semibold capitalize">{value}</dd></div>
            ))}
          </dl>
          <div className="flex flex-wrap items-start gap-2">
            {recipe.isOwner && <Link className="site-button" href={`${href}?edit=1`}>Edit recipe</Link>}
            {recipe.signedIn ? (
              <RecipeActions id={id} title={recipe.title} saved={recipe.saved} isOwner={recipe.isOwner} afterDeleteHref="/?collection=mine" />
            ) : (
              <Link className="site-button-outline" href={`/account?${new URLSearchParams({ returnTo: href })}`}>Sign in to bookmark</Link>
            )}
          </div>
        </div>
        <RecipeCover fileId={recipe.coverFileId} className="aspect-[16/10] rounded-2xl border border-line md:aspect-auto md:min-h-72" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.08fr]">
        <section aria-labelledby="ingredients-title" className="site-panel">
          <h2 id="ingredients-title" className="site-heading text-3xl">Ingredients</h2>
          <ul className="mt-3 divide-y divide-line">
            {recipe.ingredients.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-3 py-3 wrap-anywhere">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  {item.note && <p className="text-sm text-subtle">{item.note}</p>}
                </div>
                {item.quantity !== null && <span className="text-end text-subtle">{item.quantity} {item.unit}</span>}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="method-title" className="site-panel">
          <h2 id="method-title" className="site-heading text-3xl">Method</h2>
          <ol className="mt-3 divide-y divide-line">
            {recipe.steps.map((step, index) => (
              <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-4" key={step.id}>
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-sage text-sm font-semibold text-brand">{index + 1}</span>
                <p className="whitespace-pre-line leading-relaxed text-subtle wrap-anywhere">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PageFrame>
  );
}
