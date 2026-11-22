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

Recording the baseline writes migration metadata. It does not run the baseline's table-creation SQL. Do not run the baseline SQL against tables that already exist. Public application tables and their migration history have not been changed by this implementation.

## Live storage verification

`npm run storage:check` applies the migrations only within a uniquely named disposable schema on the configured PostgreSQL server. It exercises the actual Prisma adapter, recipe services, updates/deletes, constraints, and rollback, then removes the schema. Private Blob upload/read/delete is included, using a synthetic sample image and test-owned file metadata. The check never applies migrations to `public`, and it verifies Blob cleanup by the unique test-owner prefix. The database role needs schema-creation privileges. This command is explicitly manual; setup and CI do not run it.

## Future changes

Create migrations against an isolated development database, review generated SQL, and commit both the schema and migrations. Retain custom SQL checks that Prisma cannot represent. Never accept a reset prompt against a database containing needed data.

The current `User` is a profile model. Better Auth account/session/verification records and UUID generation configuration must be integrated before exposing recipe mutations. The internal recipe service requires a trusted session reader; it is not a complete sign-in workflow.
