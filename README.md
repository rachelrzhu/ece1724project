# From My Kitchen

Recipe sharing and adaptive ingredient scaling, built with Next.js, React, TypeScript, Tailwind CSS, and HeroUI. The implementation includes a Prisma/PostgreSQL foundation, recipe models, validated recipe services, private-image upload/read services, and automated checks. Better Auth persists sessions in PostgreSQL. A local backend tester exercises recipe and image services.

## Run the app

1. Install **Node.js 24** with npm, then reopen your terminal. [Node.js downloads](https://nodejs.org/en/download)
2. Clone the repo or extract the GitHub ZIP. Open the folder containing `package.json`.
3. Run `npm run setup`. On macOS you can also double-click `setup.command`, and on Windows you can double-click `setup.cmd`.
4. When the terminal says **Ready**, open [From My Kitchen on localhost](http://localhost:3000). If Next.js selects another port, use the address printed in the terminal and match that origin in your Google OAuth configuration. Press **Ctrl+C** to stop the server.

Setup installs the locked dependencies, generates the Prisma client, prepares `.env.local`, and checks the format of configured values. On first setup it generates a local authentication secret. You'll need internet access on the first run. You can open the homepage and run the unit tests without cloud credentials. If the database is unavailable, the homepage offers to reload the recipes. To try the API with seeded accounts and recipes, start in a fresh checkout and follow the [local database instructions](prisma/README.md#local-database-and-api-tests).

## Project docs

- [Architecture](docs/architecture.md) and [requirements](docs/requirements.md) cover the data model, permissions, and scaling rules.
- [Database workflow](prisma/README.md) covers migrations, local test data, and existing databases.
- [Deployment guide](docs/deployment.md) covers releases from `dev` through `preprod` to `main`.

## Frontend and backend

Next.js serves the pages and API routes from the same process.

- The Next.js App Router serves discovery at `/`, sign-in and registration at `/account`, the editor at `/recipes/new`, and recipe details at `/recipes/[id]`. Shared UI lives in `app/_components/`. Recipe mutations run through `app/actions.ts`.
- Explore searches everyone’s public recipes by title or ingredient. Select a cook’s name or @username to browse their public recipes. Open **View my recipe page** in **Account** to see all your own recipes, including private ones. Your page link stays the same when you change your username.
- Your starting username comes from your display name. For example, “Robin Lee” becomes `@robin_lee`. If another cook already has that username, you get a random number at the end. In **Account**, you can change your username once a month, edit your display name, or upload an avatar.
- Sign in to create and manage recipes under **My recipes** and revisit bookmarks under **Saved**. New recipes are private until you publish them.
- On a recipe page, scale the ingredient list by target servings or by the amount of one ingredient you have. Use **Undo** to recover the previous settings or **Reset** to return to the base recipe. The cooking instructions stay as written. See the [scaling workspace](docs/recipe-scaling.md).
- Open a public recipe while signed in to make an editable private copy. It includes the original quantities, units, and ordered steps. You can edit it and upload your own cover from the recipe editor.
- Use **Filter by allergen** in Explore to hide recorded matches or exclude an ingredient by name. This works when signed out. Sign in and set dietary preferences in **Account** to see personal conflict and incomplete-information flags.
- `app/api/health/route.ts` serves `GET /api/health`, a liveness endpoint that returns `{ "status": "ok" }` without checking cloud services.
- `lib/db/client.ts` creates the server-only Prisma client lazily. `prisma/schema.prisma` defines profiles, file metadata, recipes, ingredients, steps, and bookmarks.
- `lib/recipes/` contains Zod input contracts and owner-scoped creation, detail, listing, update, and delete services. Product Server Actions use the Better Auth session reader to authorize recipe and bookmark changes.
- `lib/storage/` validates actual image content, writes private Blob objects and file metadata, compensates failed writes, and provides owner-scoped reads.
- The homepage and account form offer **Continue with Google** when the provider is configured. Use **Account** to see the signed-in email after the callback. [Google sign-in setup](docs/deployment.md#google-sign-in)
- `/backend-test` is a temporary development-only interface for recipe CRUD and image uploads.

On subsequent runs, setup adds missing keys from `.env.example` and preserves existing values. Database features use `DATABASE_URL`. Private image services also require `BLOB_READ_WRITE_TOKEN`. Get development credentials from the project owner and keep them in `.env.local`, which is ignored by Git. The authentication API uses `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. If an older environment file has an empty secret, set it to a unique value of at least 32 characters before using authentication.

Commit migration SQL with each schema change. GitHub Actions tests the committed migrations on disposable PostgreSQL. Vercel applies pending migrations to the corresponding database when deploying `dev`, `preprod`, or `main`. See the [deployment guide](docs/deployment.md#automatic-database-migrations) for branch settings and the [database workflow](prisma/README.md) for local setup and existing databases.

## Everyday use

Run `npm run dev` to start the app again. After a dependency change, stop the dev server and rerun `npm run setup`.

| Command | When to use it |
| --- | --- |
| `npm run check` | Run Prisma validation, lint, TypeScript, and the unit and migration tests. |
| `npm test` | Run the test suite on its own. |
| `npm run test:product` | Run the two-account browser check against the seeded local app. |
| `npm run build` | Check the production build. |
| `npm run setup -- --install-only` | Install dependencies without starting the app. |
| `npm run dev -- --port 3002` | Start the dev server on a specific port. |
| `npm run env:check` | Check local configuration and see which services have credentials configured. |
| `npm run storage:probe` | Check read access to the configured development database and Blob store. |

For the browser check, start the [seeded local app](prisma/README.md#local-database-and-api-tests) with `npm run poc:dev`. In a second terminal, run `npx playwright install chromium` once, then `npm run test:product`. The test creates a recipe and cover, searches by ingredient, bookmarks from two tabs, makes the recipe private, and verifies the reader loses access after refresh. It deletes the test recipe and signs out both accounts. The uploaded file remains eligible for the local cleanup command after 24 hours.

## Simple local backend tester

Set `DATABASE_URL` in `.env.local` to your development database. Add `BLOB_READ_WRITE_TOKEN` if you're testing image uploads. From the project folder, run:

```bash
npm run backend-test:setup
npm run dev -- --hostname 127.0.0.1
```

Open `/backend-test` on the local address printed by Next.js. You can create a recipe, edit its ingredients and first cooking step, upload a cover, and inspect each HTTP response. For an ingredient like “salt to taste,” leave the quantity blank and enter “to taste” in the note.

The tester uses a fixed user in a separate PostgreSQL schema and stores its local configuration in the Git-ignored `.backend-test.json`. Its APIs accept loopback development requests and return 404 in production. Test recipes survive server restarts. When you finish with all the test data in that schema, run the following command to remove the schema, uploaded images, and local configuration.

```bash
npm run backend-test:cleanup
```

The test APIs are `GET/POST/PATCH/DELETE /api/backend-test/recipes` (use `?id=...` for a single recipe) and `GET/POST/DELETE /api/backend-test/images`. Writes require a matching `Origin` header, which the test page sends automatically.

For repeatable checks, use the [Postman collections](postman/README.md). The [November 8 CRUD review](docs/crud-review.md) records the requests, results, and fixes from that run.

## Manual live storage check

For a read-only connectivity check, run `npm run storage:probe`. It checks access to the existing database tables and lists up to one Blob object without printing object names or credentials.

With development database and Blob credentials configured, run `npm run storage:check`. It creates a temporary PostgreSQL schema, checks recipe writes and rollback, uploads and reads a sample image, then removes its test data. The database role needs permission to create schemas. The script writes its [results](docs/storage-test-results.json) to the repo.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Node or npm is missing | Install Node.js 24 with npm, reopen the terminal, and run `node --version`. With nvm, run `nvm install` and `nvm use` in the project folder. |
| PowerShell blocks `npm.ps1` | Use `setup.cmd` or run `npm.cmd run setup`. |
| npm can't find `package.json` | Open a terminal in the extracted project folder. |
| Server already running | Use the URL in the existing terminal, or stop that server with **Ctrl+C** before running setup. If a crash left a stale lock, confirm the server has stopped before removing `.next` and restarting. |
| The page won't open | Check the **Local** URL in the terminal. Next.js can choose a different port if 3000 is busy. |
| Email registration and Google sign-in both fail | Check the latest deployment’s migration logs and run `npm run db:status` against the app’s database. Both flows read the profile username and its next change date. [Migration troubleshooting](docs/deployment.md#automatic-database-migrations) |
| Package or font download fails | Check your connection or proxy, then rerun the command. |
