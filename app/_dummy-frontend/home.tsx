import { ButtonRoot as Button } from "@heroui/react/button";
import { InputRoot as Input } from "@heroui/react/input";
import { LinkRoot as Link } from "@heroui/react/link";
import { listRecipes } from "@/lib/product/queries";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const collection = params.collection === "mine" || params.collection === "saved"
    ? params.collection
    : "explore";
  const result = await listRecipes({ query, collection, page: Number(params.page) }).catch(() => null);

  function pageHref(page: number) {
    return `/?${new URLSearchParams({ q: query, collection, page: String(page) })}`;
  }

  return (
    <main>
      <h1>Recipe sharing</h1>
      <p>The frontend is still being developed. Use this wireframe to test the backend.</p>
      <nav aria-label="Recipe navigation">
        <ul>
          <li><Link href="/">Public recipes</Link></li>
          {result?.signedIn && <>
            <li><Link href="/?collection=mine">My recipes</Link></li>
            <li><Link href="/?collection=saved">Saved recipes</Link></li>
            <li><Link href="/recipes/new">Create recipe</Link></li>
          </>}
          <li><Link href="/account">{result?.signedIn ? "Account" : "Sign in or register"}</Link></li>
          <li><Link href="/api/health">API health</Link></li>
          {process.env.NODE_ENV === "development" && <li><Link href="/backend-test">Local backend tester</Link></li>}
        </ul>
      </nav>
      <h2>{{ explore: "Public recipes", mine: "My recipes", saved: "Saved recipes" }[collection]}</h2>
      <form action="/" method="get" role="search">
        <input type="hidden" name="collection" value={collection} />
        <label htmlFor="recipe-query">Search by title or ingredient</label>{" "}
        <Input id="recipe-query" name="q" type="search" maxLength={160} defaultValue={query} />{" "}
        <Button type="submit">Search</Button>
      </form>
      {!result ? (
        <p role="alert">Recipes could not be loaded. Check the database connection and migrations, then reload.</p>
      ) : !result.signedIn && collection !== "explore" ? (
        <p>Sign in to view this collection.</p>
      ) : result.total === 0 ? (
        <p>No recipes found.</p>
      ) : (
        <>
          <ul>
            {result.rows.map((recipe) => (
              <li key={recipe.id}>
                <Link href={`/recipes/${recipe.id}`}>{recipe.title}</Link> ({recipe.visibility.toLowerCase()})
              </li>
            ))}
          </ul>
          <nav aria-label="Recipe pages">
            {result.page > 1 && <Link href={pageHref(result.page - 1)}>Previous page</Link>}{" "}
            Page {result.page} of {Math.ceil(result.total / 6)}{" "}
            {result.page * 6 < result.total && <Link href={pageHref(result.page + 1)}>Next page</Link>}
          </nav>
        </>
      )}
    </main>
  );
}
