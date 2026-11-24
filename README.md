# Recipe sharing and ingredient scaling

Recipe sharing and adaptive ingredient scaling, built with Next.js, React, TypeScript, Tailwind CSS, and HeroUI. The implementation includes a Prisma/PostgreSQL foundation, recipe models, validated recipe services, private-image upload/read services, and automated checks. Better Auth persists sessions in PostgreSQL. A local backend tester exercises recipe and image services.

## Run the app

1. Install **Node.js 24** with npm, then reopen your terminal. [Node.js downloads](https://nodejs.org/en/download)
2. Clone the repo or extract the GitHub ZIP. Open the folder containing `package.json`.
3. Run `npm run setup`. On macOS you can also double-click `setup.command`, and on Windows you can double-click `setup.cmd`.
4. Open [http://localhost:3000](http://localhost:3000) to see the Savor homepage. For Google sign-in, use the hostname and port registered for the OAuth callback. The homepage also links to the backend tester in development. Press **Ctrl+C** to stop the server.

Setup installs the locked dependencies, generates the Prisma client, and creates `.env.local` if it's missing. You'll need internet access on the first run. You can open the homepage and run the unit tests without cloud credentials. To try the API with seeded accounts and recipes, start in a fresh checkout and follow the [local database instructions](prisma/README.md#local-database-and-api-tests).

## Project docs

- [Architecture](docs/architecture.md) and [requirements](docs/requirements.md) cover the data model, permissions, and scaling rules.
- [Database workflow](prisma/README.md) covers migrations, local test data, and existing databases.
- [Deployment guide](docs/deployment.md) covers releases from `dev` through `preprod` to `main`.

## Frontend and backend

Next.js serves the pages and API routes from the same process.

- The temporary HeroUI screens live in `app/_dummy-frontend/`. The page files for `/`, `/account`, `/recipes/new`, and `/recipes/[id]` each re-export one screen. To replace the wireframe, point those page files at the new screens, then remove `app/_dummy-frontend/`. The recipe server actions live in `app/actions.ts`.
- The homepage lets you search public recipes. Sign in or register at `/account` to test recipe creation, editing, deletion, cover uploads, and bookmarks.
- `app/api/health/route.ts` serves `GET /api/health`, a liveness endpoint that returns `{ "status": "ok" }` without checking cloud services.
- `lib/db/client.ts` creates the server-only Prisma client lazily. `prisma/schema.prisma` defines profiles, file metadata, recipes, ingredients, steps, and bookmarks.
- `lib/recipes/` contains Zod input contracts and owner-scoped creation, detail, listing, update, and delete services. Product Server Actions use the Better Auth session reader to authorize recipe and bookmark changes.
- `lib/storage/` validates actual image content, writes private Blob objects and file metadata, compensates failed writes, and provides owner-scoped reads.
- The homepage offers **Continue with Google** when the provider is configured and shows the signed-in account after the callback. [Google sign-in setup](docs/deployment.md#google-sign-in)
- `/backend-test` is a temporary development-only interface for recipe CRUD and image uploads.

An existing `.env.local` is left untouched. Setup copies `.env.example` only if `.env.local` is missing. Database features use `DATABASE_URL`; private image services also require `BLOB_READ_WRITE_TOKEN`. Get development credentials from the project owner and keep them in `.env.local`, which is ignored by Git. The authentication API uses `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`.

Migrations are explicit. Read the [database workflow](prisma/README.md) before running `npm run db:migrate`, especially against an existing database with `users` and `files` tables. The automated tests use isolated in-memory PostgreSQL and do not access Neon or Blob.

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

For the browser check, start the [seeded local app](prisma/README.md#local-database-and-api-tests) with `npm run poc:dev`. In a second terminal, run `npx playwright install chromium` once, then `npm run test:product`. The test creates a recipe and cover, searches by ingredient, bookmarks from two tabs, makes the recipe private, and verifies the reader loses access after refresh. It deletes the test recipe and signs out both accounts. The uploaded file remains eligible for the local cleanup command after 24 hours.

## Simple local backend tester

Set `DATABASE_URL` in `.env.local` to your development database. Add `BLOB_READ_WRITE_TOKEN` if you're testing image uploads. From the project folder, run:

```bash
npm run backend-test:setup
npm run dev -- --hostname 127.0.0.1
```

Open `/backend-test` on the local address printed by Next.js. You can create a recipe, edit its ingredients and first cooking step, upload a cover, and inspect each HTTP response. For an ingredient like “salt to taste,” leave the quantity blank and enter “to taste” in the note.

The tester uses a fixed user in a separate PostgreSQL schema. Its recipes survive server restarts. When you're done with **all** the test data in that schema, remove it and the tester's uploaded images with:

```bash
npm run backend-test:cleanup
```

The test APIs are `GET/POST/PATCH/DELETE /api/backend-test/recipes` (use `?id=...` for a single recipe) and `GET/POST/DELETE /api/backend-test/images`. Writes require a matching `Origin` header, which the test page sends automatically.

For repeatable checks, use the [Postman collections](postman/README.md). The [November 8 CRUD review](docs/crud-review.md) records the requests, results, and fixes from that run.

## Manual live storage check

With development database and Blob credentials configured, run `npm run storage:check`. It creates a temporary PostgreSQL schema, checks recipe writes and rollback, uploads and reads a sample image, then removes its test data. The database role needs permission to create schemas. The script writes its [results](docs/storage-test-results.json) to the repo.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Node or npm is missing | Install Node.js 24 with npm, reopen the terminal, and run `node --version`. With nvm, run `nvm install` and `nvm use` in the project folder. |
| PowerShell blocks `npm.ps1` | Use `setup.cmd` or run `npm.cmd run setup`. |
| npm can't find `package.json` | Open a terminal in the extracted project folder. |
| Server already running | Use the URL in the existing terminal, or stop that server with **Ctrl+C** before running setup. If a crash left a stale lock, confirm the server has stopped before removing `.next` and restarting. |
| The page won't open | Check the **Local** URL in the terminal. Next.js can choose a different port if 3000 is busy. |
| Package or font download fails | Check your connection or proxy, then rerun the command. |
