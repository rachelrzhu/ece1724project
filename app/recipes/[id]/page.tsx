import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageFrame from "@/app/_components/page-frame";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { getRecipe } from "@/lib/product/queries";
import RecipeActions from "../_components/recipe-actions";
import RecipeEditor from "../_components/recipe-editor";
import ScalingWorkspace from "../_components/scaling-workspace";

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
      <div className={`grid items-start gap-6 ${recipe.coverFileId ? "md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)] md:gap-8" : ""}`}>
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle">
            <span className="wrap-anywhere">By {recipe.authorName}</span>
            <span className="border-s border-line ps-3 font-medium capitalize">{recipe.visibility.toLowerCase()}</span>
          </div>
          <p className="max-w-[65ch] whitespace-pre-line text-base leading-relaxed text-subtle wrap-anywhere">{recipe.description}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-line py-3 sm:grid-cols-4">
            {[
              ["Base servings", recipe.baseServings],
              ["Prep", `${recipe.prepMinutes} min`],
              ["Cook", `${recipe.cookMinutes} min`],
              ["Difficulty", recipe.difficulty.toLowerCase()],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-subtle">{label}</dt>
                <dd className={`mt-1 text-base font-semibold ${label === "Difficulty" ? "capitalize" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {recipe.isOwner && <Link className="site-button" href={`${href}?edit=1`}>Edit recipe</Link>}
            {recipe.signedIn ? (
              <RecipeActions id={id} title={recipe.title} saved={recipe.saved} isOwner={recipe.isOwner} afterDeleteHref="/?collection=mine" />
            ) : (
              <Link className="site-button-outline" href={`/account?${new URLSearchParams({ returnTo: href })}`}>Sign in to bookmark</Link>
            )}
            {!recipe.coverFileId && (
              <span className="px-2 text-sm text-subtle">No cover photo</span>
            )}
          </div>
        </div>
        {recipe.coverFileId && (
          <RecipeCover fileId={recipe.coverFileId} className="aspect-[4/3] rounded-md border border-line" />
        )}
      </div>
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <ScalingWorkspace key={recipe.id} recipe={{ baseServings: recipe.baseServings, ingredients: recipe.ingredients }} />
        <section aria-labelledby="method-title" className="min-w-0 border-t border-line pt-4">
          <h2 id="method-title" className="site-heading text-2xl">Method</h2>
          <ol className="mt-2 divide-y divide-line">
            {recipe.steps.map((step, index) => (
              <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 py-4" key={step.id}>
                <span aria-hidden="true" className="pt-0.5 text-sm font-semibold tabular-nums text-subtle">{index + 1}</span>
                <p className="whitespace-pre-line leading-relaxed text-subtle wrap-anywhere">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PageFrame>
  );
}
