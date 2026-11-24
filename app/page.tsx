import { Button } from "@heroui/react/button";
import { Input } from "@heroui/react/input";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icons";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { collections, SiteHeader, type Collection } from "@/app/_components/site-header";
import { getGoogleProviderOptions, readSession } from "@/lib/auth/server";
import { listRecipes, recipePageSize, type RecipeCardData } from "@/lib/product/queries";
import GoogleSignInButton from "./account/google-sign-in-button";
import RecipeActions from "./recipes/_components/recipe-actions";

function collectionHref(collection: Collection, query = "", page = 1, hideDietaryConflicts = false) {
  const params = new URLSearchParams();
  if (collection !== "explore") params.set("collection", collection);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  if (hideDietaryConflicts) params.set("dietary", "1");
  return params.size ? `/?${params}` : "/";
}

function RecipeSearch({ collection, query, hideDietaryConflicts }: {
  collection: Collection;
  query: string;
  hideDietaryConflicts: boolean;
}) {
  return (
    <form action="/#recipes" method="get" role="search" className="flex w-full max-w-2xl gap-2">
      {hideDietaryConflicts && <input type="hidden" name="dietary" value="1" />}
      {collection !== "explore" && <input type="hidden" name="collection" value={collection} />}
      <div className="relative min-w-0 flex-1">
        <label htmlFor="recipe-query" className="sr-only">Find a recipe</label>
        <Icon name="search" className="pointer-events-none absolute inset-s-3 top-1/2 z-10 size-4 -translate-y-1/2 text-subtle" />
        <Input id="recipe-query" name="q" type="search" maxLength={160} defaultValue={query}
          placeholder="Name or ingredient" className="site-field recipe-search-input w-full" />
      </div>
      <Button type="submit" className="site-button">Search</Button>
    </form>
  );
}

function RecipeListItem({ recipe, collection }: { recipe: RecipeCardData; collection: Collection }) {
  const href = `/recipes/${recipe.id}`;
  const difficulty = recipe.source ? recipe.source.difficulty : recipe.difficulty.toLowerCase();
  const dietary = recipe.dietary;
  return (
    <article className="recipe-entry">
      <div className="grid min-w-0 items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-5">
        <div className="min-w-0">
          <h2 className="site-heading text-base sm:text-lg">
            <Link href={href} data-recipe-title className="after:absolute after:inset-0">{recipe.title}</Link>
          </h2>
          {recipe.source ? (
            <p className="mt-1 text-sm text-subtle wrap-anywhere">
              <a href={recipe.source.url} className="relative z-10 underline">Original recipe by {recipe.source.contributor} on HowToCook</a>
            </p>
          ) : recipe.author.name && collection !== "mine" && (
            <p className="mt-1 text-sm text-subtle wrap-anywhere">By {recipe.author.name}</p>
          )}
          <p className="mt-1 line-clamp-2 max-w-[65ch] text-sm text-subtle wrap-anywhere">{recipe.description}</p>
          {dietary && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {dietary.conflicts.length > 0 && (
                <span className="font-semibold text-rust">
                  {dietary.conflicts.length} {dietary.conflicts.length === 1 ? "ingredient" : "ingredients"} with known conflicts
                </span>
              )}
              {dietary.unknownIngredients.length > 0 && (
                <span className="text-subtle">
                  {dietary.unknownIngredients.length} {dietary.unknownIngredients.length === 1 ? "ingredient" : "ingredients"} with incomplete information
                </span>
              )}
              {!dietary.conflicts.length && !dietary.unknownIngredients.length && (
                <span className="text-subtle">No known conflicts in mapped ingredients.</span>
              )}
            </div>
          )}
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle md:max-w-60 md:justify-end">
          {recipe.durationLabel && <li className="inline-flex items-center gap-1"><Icon name="clock" className="size-4" />{recipe.durationLabel}</li>}
          <li>Serves {recipe.baseServings}</li>
          {difficulty && <li className="capitalize">{recipe.source && "Source difficulty "}{difficulty}</li>}
          {collection === "mine" && <li className="capitalize">{recipe.visibility.toLowerCase()}</li>}
          {recipe.saved && <li className="inline-flex items-center gap-1"><Icon name="bookmark" className="size-4" />Saved</li>}
        </ul>
      </div>
      <RecipeCover fileId={recipe.coverFileId} className="size-16 rounded-md border border-line sm:size-20" />
      {collection === "mine" && (
        <div className="relative z-10 col-span-full flex w-fit flex-wrap items-center gap-2 pt-2">
          <Link href={`${href}?edit=1`} className="site-button-outline" aria-label={`Edit ${recipe.title}`}>Edit</Link>
          <RecipeActions id={recipe.id} title={recipe.title} isOwner />
        </div>
      )}
    </article>
  );
}

function ResultsLoading() {
  return (
    <div aria-busy="true" role="status" className="space-y-3 text-sm text-subtle">
      <p>Loading recipes…</p>
      <div aria-hidden="true" className="divide-y divide-line border-y border-line">
        {[0, 1].map((item) => (
          <div key={item} className="space-y-2 py-5 motion-safe:animate-pulse">
            <div className="h-4 w-1/3 rounded-sm bg-canvas" />
            <div className="h-3 w-1/2 rounded-sm bg-canvas" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function RecipeResults({ collection, query, page, signedIn, hideDietaryConflicts }: {
  collection: Collection;
  query: string;
  page: number;
  signedIn: boolean;
  hideDietaryConflicts: boolean;
}) {
  if (!signedIn && collection !== "explore") {
    return (
      <div className="site-panel space-y-3">
        <p>Sign in to view {collection === "mine" ? "your recipes" : "your saved recipes"}.</p>
        <Link className="site-button" href="/account">Sign in</Link>
      </div>
    );
  }

  const result = await listRecipes({ collection, query, page, hideDietaryConflicts }).catch(() => null);
  if (!result) {
    return (
      <div className="site-panel space-y-3">
        <p role="alert" className="font-semibold">Couldn’t load recipes.</p>
        <a className="site-button-outline" href={collectionHref(collection, query, page, hideDietaryConflicts)}>Reload recipes</a>
      </div>
    );
  }

  const filtering = result.hasDietaryPreferences && hideDietaryConflicts;
  const dietaryFilter = result.hasDietaryPreferences && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link className="site-button-outline" href={collectionHref(collection, query, result.page, !filtering) + "#recipes"}
        aria-describedby="dietary-filter-help">{filtering ? "Show all recipes" : "Hide known conflicts"}</Link>
      <p id="dietary-filter-help" className="text-sm text-subtle">
        {filtering ? "Known conflicts with your preferences are hidden." : "Filter by your dietary preferences."}
        {" "}Recipes with incomplete records stay visible unless they have a known conflict.
      </p>
    </div>
  );

  if (result.total === 0) {
    const emptyMessage = filtering ? "No recipes match the current dietary filter."
      : collection === "mine" ? "You haven’t created any recipes yet."
      : collection === "saved" ? "You haven’t saved any recipes yet." : "No public recipes have been shared yet.";
    return (
      <div className="site-panel space-y-3">
        {dietaryFilter}
        <p className="font-semibold wrap-anywhere">{query ? `No recipes match “${query}”.` : emptyMessage}</p>
        {query && <Link className="site-button-outline" href={collectionHref(collection, "", 1, filtering)}>Clear search</Link>}
        {!query && !filtering && collection === "mine" && <Link className="site-button" href="/recipes/new">Create a recipe</Link>}
        {!query && !filtering && collection === "saved" && <Link className="site-button-outline" href="/">Explore recipes</Link>}
      </div>
    );
  }

  const pageCount = Math.ceil(result.total / recipePageSize);
  return (
    <div className="space-y-5">
      {dietaryFilter}
      <p className="text-sm text-subtle" aria-live="polite">{result.total} {result.total === 1 ? "recipe" : "recipes"}</p>
      <ul aria-label={collections[collection].heading} className="divide-y divide-line border-y border-line">
        {result.rows.map((recipe) => <li key={recipe.id}><RecipeListItem recipe={recipe} collection={collection} /></li>)}
      </ul>
      {pageCount > 1 && (
        <nav aria-label="Recipe pages" className="flex flex-wrap items-center gap-3">
          {result.page > 1 && <Link className="site-button-outline" href={`${collectionHref(collection, query, result.page - 1, filtering)}#recipes`}>Previous</Link>}
          <span className="text-sm text-subtle">Page {result.page} of {pageCount}</span>
          {result.page < pageCount && <Link className="site-button-outline" href={`${collectionHref(collection, query, result.page + 1, filtering)}#recipes`}>Next</Link>}
        </nav>
      )}
    </div>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const [params, session] = await Promise.all([searchParams, readSession().catch(() => null)]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  const collection = params.collection === "mine" || params.collection === "saved" ? params.collection : "explore";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const signedIn = Boolean(session);
  const hideDietaryConflicts = signedIn && params.dietary === "1";

  return (
    <>
      <SiteHeader user={session?.user} active={collection} />
      <main id="main-content" tabIndex={-1} className="site-container space-y-6 py-7 sm:space-y-8 sm:py-10">
        {params.error && (
          <p role="alert" className="site-panel text-sm text-rust">
            {params.error === "access_denied" ? "Google sign-in was canceled." : "Google sign-in couldn’t be completed."} Try signing in again.
          </p>
        )}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="site-heading text-3xl sm:text-4xl">
              {collection === "explore" ? "Explore recipes" : collections[collection].heading}
            </h1>
            {collection === "explore" && !signedIn && getGoogleProviderOptions() && <GoogleSignInButton />}
          </div>
          {(collection === "explore" || signedIn) && (
            <RecipeSearch key={`${collection}:${query}`} collection={collection} query={query} hideDietaryConflicts={hideDietaryConflicts} />
          )}
        </header>
        <section id="recipes" aria-label={collections[collection].heading} className="scroll-mt-5">
          <Suspense key={`${collection}:${query}:${page}:${hideDietaryConflicts}`} fallback={<ResultsLoading />}>
            <RecipeResults collection={collection} query={query} page={page} signedIn={signedIn} hideDietaryConflicts={hideDietaryConflicts} />
          </Suspense>
        </section>
      </main>
    </>
  );
}
