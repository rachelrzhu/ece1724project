import { Button } from "@heroui/react/button";
import { Input } from "@heroui/react/input";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icons";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { collections, SiteHeader, type Collection } from "@/app/_components/site-header";
import { getGoogleProviderOptions, readSession } from "@/lib/auth/server";
import { listRecipes, recipePageSize, type RecipeCardData } from "@/lib/product/queries";
import AccountButton from "./account-button";
import RecipeActions from "./recipes/_components/recipe-actions";

function collectionHref(collection: Collection, query = "", page = 1) {
  const params = new URLSearchParams();
  if (collection !== "explore") params.set("collection", collection);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/?${params}` : "/";
}

function RecipeSearch({ collection, query }: { collection: Collection; query: string }) {
  return (
    <form action="/#recipes" method="get" role="search" className={collection === "explore" ? "kitchen-index-form" : "max-w-xl"}>
      {collection !== "explore" && <input type="hidden" name="collection" value={collection} />}
      <label htmlFor="recipe-query" className="block font-serif text-3xl leading-tight font-semibold tracking-tight">Find a recipe</label>
      <p id="recipe-search-help" className="mt-1 text-sm text-subtle">Search by name or ingredient.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-30 flex-1">
          <Icon name="search" className="pointer-events-none absolute inset-s-3 top-1/2 z-10 size-4 -translate-y-1/2 text-subtle" />
          <Input id="recipe-query" name="q" type="search" maxLength={160} defaultValue={query}
            aria-describedby="recipe-search-help" placeholder="e.g. lemon"
            className="site-field recipe-search-input w-full" />
        </div>
        <Button type="submit" className="site-button">Search</Button>
      </div>
    </form>
  );
}

function RecipeCard({ recipe, collection }: { recipe: RecipeCardData; collection: Collection }) {
  const href = `/recipes/${recipe.id}`;
  return (
    <article className="kitchen-recipe-entry">
      <div className="min-w-0">
        <h3 className="site-heading text-[1.8rem] sm:text-[2rem]">
          <Link href={href} data-recipe-title className="hover:text-brand after:absolute after:inset-0">{recipe.title}</Link>
        </h3>
        {recipe.author.name && collection !== "mine" && (
          <p className="mt-1 text-sm text-subtle wrap-anywhere">From {recipe.author.name}</p>
        )}
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-subtle wrap-anywhere">{recipe.description}</p>
        <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-brand sm:gap-x-4">
          <li className="inline-flex items-center gap-1"><Icon name="clock" className="size-3.5" />{recipe.prepMinutes + recipe.cookMinutes} min</li>
          <li>Serves {recipe.baseServings}</li>
          <li className="capitalize">{recipe.difficulty.toLowerCase()}</li>
          {collection === "mine" && <li className="capitalize">{recipe.visibility.toLowerCase()}</li>}
          {recipe.saved && <li className="inline-flex items-center gap-1"><Icon name="bookmark" className="size-3.5" />Saved</li>}
        </ul>
      </div>
      {recipe.coverFileId && (
        <RecipeCover fileId={recipe.coverFileId} className="mt-0.5 size-17 border border-line sm:size-22 lg:size-26" />
      )}
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
      <div aria-hidden="true" className="grid gap-x-8 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="space-y-3 border-t border-line py-5 motion-safe:animate-pulse">
            <div className="h-5 w-1/2 bg-tint" />
            <div className="h-3 w-3/4 bg-tint" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function RecipeResults({ collection, query, page, signedIn }: {
  collection: Collection;
  query: string;
  page: number;
  signedIn: boolean;
}) {
  if (!signedIn && collection !== "explore") {
    return (
      <div className="site-panel space-y-3">
        <p>Sign in to view {collection === "mine" ? "your recipes" : "your saved recipes"}.</p>
        <Link className="site-button" href="/account">Sign in</Link>
      </div>
    );
  }

  const result = await listRecipes({ collection, query, page }).catch(() => null);
  if (!result) {
    return (
      <div className="site-panel space-y-3">
        <p role="alert" className="font-semibold">Recipes couldn’t be loaded.</p>
        <p className="text-sm text-subtle">Try refreshing the page in a moment.</p>
      </div>
    );
  }

  if (result.total === 0) {
    const emptyMessage = collection === "mine" ? "You haven’t created any recipes yet."
      : collection === "saved" ? "You haven’t saved any recipes yet." : "No public recipes have been shared yet.";
    return (
      <div className="site-panel space-y-3">
        <p className="font-semibold wrap-anywhere">{query ? `No recipes match “${query}”.` : emptyMessage}</p>
        {query && <Link className="site-button-outline" href={collectionHref(collection)}>Clear search</Link>}
        {!query && collection === "mine" && <Link className="site-button" href="/recipes/new">Create a recipe</Link>}
        {!query && collection === "saved" && <Link className="site-button-outline" href="/">Explore recipes</Link>}
      </div>
    );
  }

  const pageCount = Math.ceil(result.total / recipePageSize);
  return (
    <div className="space-y-5">
      <p className="text-sm text-subtle" aria-live="polite">{result.total} {result.total === 1 ? "recipe" : "recipes"}</p>
      <ul aria-label={collections[collection].heading} className="grid gap-x-10 md:grid-cols-2 lg:gap-x-14">
        {result.rows.map((recipe) => <li key={recipe.id}><RecipeCard recipe={recipe} collection={collection} /></li>)}
      </ul>
      {pageCount > 1 && (
        <nav aria-label="Recipe pages" className="flex flex-wrap items-center gap-3">
          {result.page > 1 && <Link className="site-button-outline" href={`${collectionHref(collection, query, result.page - 1)}#recipes`}>Previous</Link>}
          <span className="text-sm text-subtle">Page {result.page} of {pageCount}</span>
          {result.page < pageCount && <Link className="site-button-outline" href={`${collectionHref(collection, query, result.page + 1)}#recipes`}>Next</Link>}
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

  return (
    <>
      <SiteHeader signedIn={signedIn} active={collection} />
      <main id="main-content" tabIndex={-1} className="site-container space-y-5 pb-12 sm:space-y-7 sm:pb-16">
        {params.error && (
          <p role="alert" className="site-panel mt-5 text-sm text-rust">
            {params.error === "access_denied" ? "Google sign-in was canceled." : "Google sign-in couldn’t be completed."} Try signing in again.
          </p>
        )}
        {collection === "explore" && (
          <section aria-labelledby="discovery-title" className="kitchen-intro">
            <div className="min-w-0">
              <h1 id="discovery-title" className="kitchen-intro-title">
                What are we <em className="block font-normal text-brand">cooking?</em>
              </h1>
              <p className="mt-5 max-w-[39ch] text-base leading-relaxed text-subtle sm:mt-6 sm:text-lg">
                Recipes from home cooks, for however many are at your table.
              </p>
            </div>
            <div className="kitchen-index-card">
              <RecipeSearch key={query} collection={collection} query={query} />
            </div>
          </section>
        )}
        <section id="recipes" aria-labelledby="collection-heading" className={`space-y-5 scroll-mt-5 ${collection === "explore" ? "" : "pt-8 sm:pt-12"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-brand pt-4">
            {collection === "explore" ? (
              <h2 id="collection-heading" className="site-heading text-4xl sm:text-5xl">{collections[collection].heading}</h2>
            ) : (
              <h1 id="collection-heading" className="site-heading text-5xl sm:text-6xl">{collections[collection].heading}</h1>
            )}
            {collection === "explore" && !signedIn && getGoogleProviderOptions() && <AccountButton signedIn={false} />}
          </div>
          {collection !== "explore" && signedIn && <RecipeSearch key={`${collection}:${query}`} collection={collection} query={query} />}
          <Suspense key={`${collection}:${query}:${page}`} fallback={<ResultsLoading />}>
            <RecipeResults collection={collection} query={query} page={page} signedIn={signedIn} />
          </Suspense>
        </section>
      </main>
    </>
  );
}
