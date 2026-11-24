import { ButtonRoot as Button } from "@heroui/react/button";
import { InputRoot as Input } from "@heroui/react/input";
import { LinkRoot as Link } from "@heroui/react/link";
import AccountButton from "@/app/account-button";
import { getGoogleProviderOptions, readSession } from "@/lib/auth/server";
import { listRecipes } from "@/lib/product/queries";
import PageFrame from "./page-frame";
import RecipeActions from "./recipe-actions";
import RecipeEditor from "./recipe-editor";

const collectionTitles = {
  explore: "Public recipes",
  mine: "My recipes",
  saved: "Saved recipes",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const [params, session] = await Promise.all([searchParams, readSession().catch(() => null)]);
  const query = typeof params.q === "string" ? params.q : "";
  const collection = params.collection === "mine" || params.collection === "saved"
    ? params.collection
    : "explore";
  const result = await listRecipes({
    query,
    collection,
    page: Number(params.page),
  }).catch(() => null);

  function pageHref(page: number) {
    return `/?${new URLSearchParams({ q: query, collection, page: String(page) })}`;
  }

  return (
    <PageFrame title="Savor recipes">
      <p>The frontend is still being developed.</p>
      <nav aria-label="Recipe navigation" className="flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/" aria-current={collection === "explore" ? "page" : undefined}>
          Public recipes
        </Link>
        {session && (
          <>
            <Link href="/?collection=mine" aria-current={collection === "mine" ? "page" : undefined}>
              My recipes
            </Link>
            <Link href="/?collection=saved" aria-current={collection === "saved" ? "page" : undefined}>
              Saved recipes
            </Link>
          </>
        )}
        <Link href="/account">{session ? "Account" : "Sign in or register"}</Link>
      </nav>

      {session && <p>Signed in as {session.user.email}</p>}
      {(session || getGoogleProviderOptions()) && <AccountButton signedIn={Boolean(session)} />}
      {params.error && (
        <p role="alert">
          {params.error === "access_denied"
            ? "Google sign-in was canceled. You can try again."
            : "Google sign-in could not be completed. Please try again."}
        </p>
      )}

      {session && (
        <details>
          <summary className="cursor-pointer text-lg font-semibold">Create recipe</summary>
          <div className="mt-3"><RecipeEditor /></div>
        </details>
      )}

      <section aria-labelledby="collection-heading" className="space-y-3">
        <h2 id="collection-heading" className="text-xl font-semibold">{collectionTitles[collection]}</h2>
        <form action="/" method="get" role="search" className="space-y-1">
          <input type="hidden" name="collection" value={collection} />
          <label htmlFor="recipe-query">Search by title or ingredient</label>
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              id="recipe-query"
              name="q"
              type="search"
              maxLength={160}
              defaultValue={query}
            />
            <Button type="submit">Search</Button>
          </div>
        </form>
        {!result ? (
          <p role="alert">Recipes could not be loaded. Check the database connection and migrations, then reload.</p>
        ) : !result.signedIn && collection !== "explore" ? (
          <p>Sign in to view this collection.</p>
        ) : result.total === 0 ? (
          <p>No recipes found.</p>
        ) : (
          <>
            <ul className="divide-y divide-separator">
              {result.rows.map((recipe) => (
                <li key={recipe.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link className="wrap-anywhere" href={`/recipes/${recipe.id}`}>{recipe.title}</Link>
                    <p className="text-sm">
                      Serves {recipe.baseServings}{recipe.durationLabel && ` · ${recipe.durationLabel}`}
                      {collection === "mine" && ` · ${recipe.visibility.toLowerCase()}`}
                    </p>
                  </div>
                  {collection === "mine" && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/recipes/${recipe.id}?edit=1`} aria-label={`Edit ${recipe.title}`}>Edit</Link>
                      <RecipeActions id={recipe.id} title={recipe.title} isOwner />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <nav aria-label="Recipe pages" className="flex flex-wrap gap-3">
              {result.page > 1 && <Link href={pageHref(result.page - 1)}>Previous page</Link>}
              <span>Page {result.page} of {Math.ceil(result.total / 6)}</span>
              {result.page * 6 < result.total && <Link href={pageHref(result.page + 1)}>Next page</Link>}
            </nav>
          </>
        )}
      </section>

      <footer className="flex flex-wrap gap-4">
        <Link href="/api/health">API health</Link>
        {process.env.NODE_ENV === "development" && <Link href="/backend-test">Local backend tester</Link>}
      </footer>
    </PageFrame>
  );
}
