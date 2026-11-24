# Database workflow

Prisma owns the schema and migration history. `DATABASE_URL` is used by the runtime client. The CLI prefers `DIRECT_URL`, falling back to `DATABASE_URL`. Environment values load from the project's Next.js environment files, including `.env.local`.

Installation and builds generate the client but never change the database. The homepage, health endpoint, and automated tests work without database credentials.

## Local commands

```bash
npm run db:generate   # Regenerate TypeScript client after schema changes
npm run db:validate   # Validate schema syntax without a connection
npm test             # Run isolated validation/service/PGlite tests
npm run storage:check # Manual live CRUD and private-image round trip; requires credentials
```

## Empty development database

Use a dedicated development database. Set its URLs in `.env.local`, review the migration SQL, then run:

```bash
npm run db:migrate
```

This explicitly applies the baseline, recipe, and authentication migrations to the selected database. Do not use a production connection for development tests.

## Existing database with users and files

`0_baseline` describes the existing profile and file tables, including UUID keys, named uniqueness constraints/indexes, the file-owner foreign key, and `files_size_positive`. The next migration adds recipes, ingredients, steps, and bookmarks.

Before adopting this history:

1. Confirm the selected database and preserve a recoverable backup/branch.
2. Compare its existing schema with `0_baseline/migration.sql`, including defaults, nullability, indexes, and constraints. Resolve differences before proceeding.
3. Check for an existing Prisma migration history. Reconcile it before adopting a new baseline.
4. For a matching database without Prisma history, record the existing baseline:

   ```bash
   npx prisma migrate resolve --applied 0_baseline
   ```

5. Review the pending recipe and authentication migrations and apply them with `npm run db:migrate`.

Recording the baseline writes migration metadata. Do not run the baseline SQL against tables that already exist. Run `npx prisma migrate status` to check the selected database against the committed migration history.

## Cloud development fixtures

The development Neon database contains 16 public demo recipes shared by eight fictional cooks. Three are English translations from the Chinese cookbook HowToCook. Their detail pages credit the original contributors and link to the Chinese editions. Each recipe has ordered ingredients, steps, and a cover in the development private Blob store. The [demo catalog](../scripts/demo-recipes.ts) assigns stable IDs to cooks, recipes, and covers. [Recipe and photo sources](../public/images/SOURCES.md) are listed with the assets. The cloud demo profiles have no login credentials. The local seed also creates two password-based logins and a private recipe for testing on loopback.

On a deployment that includes the image route, request `/api/images/30000000-0000-4000-8000-000000000001` to read the first demo cover. A successful response reads the file metadata from PostgreSQL and streams the JPEG from Blob. The separate `/api/health` endpoint checks application liveness.

## Local database and API tests

Use a fresh checkout with Node.js 24 and the PostgreSQL 18 tools (`initdb` and `pg_ctl`) on your PATH. Run these commands in the first terminal:

```bash
npm ci
npm run poc:setup
npm run poc:dev
```

Setup starts PostgreSQL on `127.0.0.1:55432`, applies the migrations, and seeds two accounts and sample recipes. It keeps the database and images in `.local-poc/` and writes the connection settings to `.env.local`. Keep any existing development credentials in their own checkout.

With the app running on `http://127.0.0.1:3100`, open a second terminal in the same folder:

```bash
npm run poc:verify
```

The check signs in over HTTP, writes a recipe, and tests who can read its cover before and after publication. When you're done, stop the app with **Ctrl+C** and run `npm run poc:stop-db`. Your local recipes will still be there the next time you run `npm run poc:setup`.

## Live storage verification

`npm run storage:check` applies the migrations only within a uniquely named disposable schema on the configured PostgreSQL server. It exercises the actual Prisma adapter, recipe services, updates/deletes, constraints, and rollback, then removes the schema. Private Blob upload/read/delete is included, using a synthetic sample image and test-owned file metadata. The check never applies migrations to `public`, and it verifies Blob cleanup by the unique test-owner prefix. The database role needs schema-creation privileges. This command is explicitly manual; setup and CI do not run it.

## Future changes

Create migrations against an isolated development database, review generated SQL, and commit both the schema and migrations. Retain custom SQL checks that Prisma cannot represent. Never accept a reset prompt against a database containing needed data.

Better Auth uses the existing user UUIDs and stores accounts, sessions, and verifications in PostgreSQL.

## Reclaim unused cloud covers

Use the target deployment’s paired PostgreSQL and private Blob credentials. Independently look up its database host and database name in Neon and its `store_…` ID in Vercel. The command compares both identifiers with the active credentials before connecting. Supplying identifiers from the wrong pair can still select the wrong resources. Use the environment’s documented mapping, especially for cloned databases that may contain the same user IDs.

```bash
npm run images:cleanup -- --database HOST/DATABASE --store store_ID
npm run images:cleanup -- --database HOST/DATABASE --store store_ID --owner PRODUCT_USER_UUID
npm run images:cleanup -- --database HOST/DATABASE --store store_ID --path recipe-images/OWNER_UUID/FILE_UUID.jpg
```

The first command previews unattached product file records older than 24 hours. Include the port in `HOST` when it is explicit in the database URL. The owner option also checks that cook’s Blob prefix for old uploads without matching metadata. The path option retries a single object using the generated path from a private server log entry labeled `Cover cleanup retry required`. Use owner discovery for uploads interrupted before logging. Only an existing user in the product database can be selected for storage discovery.

Review the preview and add `--apply` to the same command to reclaim eligible covers. The command checks file age and rechecks attachment under a database row lock. It commits metadata removal before deleting the matching Blob version. If interrupted or the provider is unavailable, rerun with the exact path printed in the private command output or the owner option. A changed Blob version is preserved for another review. Keep this output private.

The cloud command manages server-generated `recipe-images/<owner UUID>/<file UUID>.<jpg|png|webp>` keys. It leaves other uploaders’ namespaces and seed assets in place. Review legacy files with custom paths against their original owner and schema before manual cleanup. Ownerless Blob keys without matching product metadata require independent provenance. The loopback demo continues to use `npm run poc:cleanup-images`.
