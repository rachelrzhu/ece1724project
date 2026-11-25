import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CookByline } from "@/app/_components/cook-byline";
import { Icon } from "@/app/_components/icons";
import { Button, ButtonLink, Card } from "@/app/_components/material";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { RecipeReactions } from "@/app/_components/recipe-reactions";
import { collections, SiteHeader, type Collection } from "@/app/_components/site-header";
import { getGoogleProviderOptions, readSession } from "@/lib/auth/server";
import { parseAllergenFilter } from "@/lib/dietary/policy";
import { readDietaryPreferences } from "@/lib/dietary/server";
import { parseMaxMinutes } from "@/lib/recipes/ready-in";
import { listRecipes, recipePageSize, type PublicCook, type RecipeCardData } from "@/lib/product/queries";
import GoogleSignInButton from "@/app/account/google-sign-in-button";
import RecipeActions from "@/app/recipes/_components/recipe-actions";
import { collectionHref, RecipeFilters, type BrowseState } from "./recipe-filters";
import styles from "./recipe-collection.module.css";

function RecipeEntry({ recipe, collection, showAuthor, signedIn, returnTo }: {
  recipe: RecipeCardData;
  collection: Collection;
  showAuthor: boolean;
  signedIn: boolean;
  returnTo: string;
}) {
  const href = `/recipes/${recipe.id}`;
  const difficulty = recipe.source ? recipe.source.difficulty : recipe.difficulty.toLowerCase();
  const dietary = recipe.dietary;
  return (
    <Card as="article" className={styles.entry}>
      <RecipeCover fileId={recipe.coverFileId} className={styles.cover} />
      <div className={styles.body}>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-subtle">
          {recipe.durationLabel && <li className="inline-flex items-center gap-1"><Icon name="clock" className="size-3.5" />{recipe.durationLabel}</li>}
          <li>Serves {recipe.baseServings}</li>
          {difficulty && <li className="capitalize">{recipe.source && "Source difficulty "}{difficulty}</li>}
          {collection === "mine" && <li className="capitalize">{recipe.visibility.toLowerCase()}</li>}
          {recipe.saved && <li className="inline-flex items-center gap-1"><Icon name="bookmark" className="size-3.5" />Saved</li>}
        </ul>
        <h2 className={`${styles.title} wrap-anywhere`}>
          <Link href={href} data-recipe-title>{recipe.title}</Link>
        </h2>
        <p className="line-clamp-2 max-w-[65ch] text-sm text-subtle wrap-anywhere">{recipe.description}</p>
        {recipe.source && (
          <p className="text-xs text-subtle wrap-anywhere">
            <a href={recipe.source.url} className="relative z-10 underline">Original recipe by {recipe.source.contributor} on HowToCook</a>
          </p>
        )}
        {showAuthor && (
          <p className="text-xs text-subtle wrap-anywhere">{recipe.source ? "Shared by" : "By"}{" "}
            <CookByline cook={recipe.author} />
          </p>
        )}
        {dietary && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
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
        <div className={styles.footer}>
          <RecipeReactions id={recipe.id} title={recipe.title} reactions={recipe.reactions} signedIn={signedIn} returnTo={returnTo} />
          {collection === "mine" && (
            <>
              <ButtonLink href={`${href}?edit=1`} variant="outline" isPill className="min-h-11" aria-label={`Edit ${recipe.title}`}>Edit</ButtonLink>
              <RecipeActions id={recipe.id} title={recipe.title} isOwner />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ViewPicker({ state }: { state: BrowseState }) {
  return (
    <nav aria-label="Recipe display" className={styles.layoutPicker}>
      {(["cards", "list"] as const).map((view) => (
        <ButtonLink key={view} href={collectionHref({ ...state, view }) + "#recipes"} scroll={false} variant="ghost" className="border-0"
          aria-current={state.view === view ? "page" : undefined}>
          <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            {view === "cards"
              ? <path d="M2.5 2.5h6v6h-6zM11.5 2.5h6v6h-6zM2.5 11.5h6v6h-6zM11.5 11.5h6v6h-6z" />
              : <path strokeLinecap="round" d="M3 4h1m3 0h10M3 10h1m3 0h10M3 16h1m3 0h10" />}
          </svg>
          {view === "cards" ? "Cards" : "List"}
        </ButtonLink>
      ))}
    </nav>
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

async function RecipeResults({ state, cookId, signedIn }: { state: BrowseState; cookId?: string; signedIn: boolean }) {
  const { collection, query, page, maxMinutes, hideDietaryConflicts, allergenFilter } = state;
  const returnTo = collectionHref(state);
  if (!signedIn && collection !== "explore") {
    return (
      <div className="site-panel space-y-3">
        <p>Sign in to view {collection === "mine" ? "your recipes" : "your saved recipes"}.</p>
        <ButtonLink isPill className="min-h-11" href={`/account?${new URLSearchParams({ returnTo })}`}>Sign in</ButtonLink>
      </div>
    );
  }

  const result = await listRecipes({ collection, authorId: cookId, query, page, maxMinutes, hideDietaryConflicts, allergenFilter }).catch(() => null);
  if (!result) {
    return (
      <div className="site-panel space-y-3">
        <p role="alert" className="font-semibold">Couldn’t load recipes.</p>
        <Button as="a" variant="outline" isPill className="min-h-11" href={returnTo}>Reload recipes</Button>
      </div>
    );
  }

  const pageCount = Math.ceil(result.total / recipePageSize);
  const hasExclusions = hideDietaryConflicts || Boolean(allergenFilter?.allergens.length || allergenFilter?.ingredient);
  const filtered = Boolean(query || maxMinutes || hasExclusions);
  const emptyMessage = maxMinutes && !hasExclusions ? `No recipes have a recorded time of ${maxMinutes} min or less.`
    : hasExclusions ? "No recipes match these filters."
    : collection === "mine" ? "You haven’t created any recipes yet."
    : collection === "saved" ? "You haven’t saved any recipes yet." : "No public recipes have been shared yet.";
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-subtle" aria-live="polite">{result.total} {result.total === 1 ? "recipe" : "recipes"}</p>
        <ViewPicker state={state} />
      </div>
      {result.total === 0 ? (
        <div className="site-panel space-y-3">
          <p className="font-semibold wrap-anywhere">{query ? `No recipes match “${query}”.` : emptyMessage}</p>
          {filtered && <p className="text-sm text-subtle">Try removing a filter or broadening your search.</p>}
          {!filtered && collection === "mine" && <ButtonLink isPill className="min-h-11" href="/recipes/new">Create a recipe</ButtonLink>}
          {!filtered && collection === "saved" && <ButtonLink variant="outline" isPill className="min-h-11" href="/recipes">Explore recipes</ButtonLink>}
        </div>
      ) : (
        <ul aria-label={collections[collection].heading} className={`${styles.entries} ${styles[state.view]}`}>
          {result.rows.map((recipe) => (
            <li key={recipe.id}>
              <RecipeEntry recipe={recipe} collection={collection} showAuthor={!cookId && collection !== "mine"} signedIn={signedIn} returnTo={returnTo} />
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 && (
        <nav aria-label="Recipe pages" className="flex flex-wrap items-center gap-3">
          {result.page > 1 && <ButtonLink variant="outline" isPill className="min-h-11" href={`${collectionHref({ ...state, page: result.page - 1 })}#recipes`}>Previous</ButtonLink>}
          <span className="text-sm text-subtle">Page {result.page} of {pageCount}</span>
          {result.page < pageCount && <ButtonLink variant="outline" isPill className="min-h-11" href={`${collectionHref({ ...state, page: result.page + 1 })}#recipes`}>Next</ButtonLink>}
        </nav>
      )}
    </div>
  );
}

export default async function RecipeCollection({ searchParams, cook }: {
  searchParams: PageProps<"/recipes">["searchParams"];
  cook?: PublicCook;
}) {
  const [params, session, preferences] = await Promise.all([
    searchParams, readSession().catch(() => null), readDietaryPreferences().catch(() => null),
  ]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  const ownPage = Boolean(cook && cook.id === session?.user.id);
  const collection = cook ? (ownPage ? "mine" : "explore")
    : params.collection === "mine" || params.collection === "saved" ? params.collection : "explore";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const signedIn = Boolean(session);
  const hasPreferences = Boolean(preferences && (preferences.diet !== "NONE" || preferences.allergens.length));
  const hideDietaryConflicts = hasPreferences && params.dietary === "1";
  const maxMinutes = parseMaxMinutes(typeof params.maxMinutes === "string" ? params.maxMinutes : undefined);
  const allergenFilter = !cook && collection === "explore" ? parseAllergenFilter(params.allergen, params.exclude) : undefined;
  const state: BrowseState = {
    path: cook ? `/users/${cook.id}` : "/recipes",
    collection, query, page, maxMinutes, hideDietaryConflicts, allergenFilter,
    view: params.view === "list" ? "list" : "cards",
  };
  const searchKey = collectionHref({ ...state, page: 1 });

  return (
    <>
      <SiteHeader user={session?.user} active={cook ? undefined : collection} />
      <main id="main-content" tabIndex={-1} className="site-container space-y-6 py-7 sm:space-y-8 sm:py-10">
        {!cook && params.error && (
          <p role="alert" className="site-panel text-sm text-rust">
            {params.error === "access_denied" ? "Google sign-in was canceled." : "Google sign-in couldn’t be completed."} Try signing in again.
          </p>
        )}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              {cook && (cook.image
                ? <Image src={cook.image} unoptimized width={64} height={64} alt="" className="size-16 shrink-0 rounded-full object-cover" />
                : <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-brand text-2xl font-bold text-white">
                    {Array.from(cook.name?.trim() || cook.username)[0]?.toUpperCase()}
                  </span>)}
              <div className="min-w-0">
                <h1 className={`${styles.heading} wrap-anywhere`}>
                  {cook ? `${cook.name || cook.username}’s ${ownPage ? "recipes" : "public recipes"}`
                    : collection === "explore" ? "Explore recipes" : collections[collection].heading}
                </h1>
                {cook && <p className="mt-1 text-sm text-subtle wrap-anywhere">@{cook.username}</p>}
                {ownPage && <p className="mt-1 text-sm text-subtle">Only you can see your private recipes.</p>}
              </div>
            </div>
            {!cook && collection === "explore" && !signedIn && getGoogleProviderOptions() && <GoogleSignInButton />}
          </div>
          {(collection === "explore" || signedIn) && (
            <RecipeFilters key={searchKey} state={state} hasPreferences={hasPreferences} />
          )}
        </header>
        <section id="recipes" aria-label={collections[collection].heading} className="scroll-mt-5">
          <Suspense key={`${searchKey}:${page}`} fallback={<ResultsLoading />}>
            <RecipeResults state={state} cookId={cook?.id} signedIn={signedIn} />
          </Suspense>
        </section>
      </main>
    </>
  );
}
