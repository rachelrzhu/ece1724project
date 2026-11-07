# Database initialization and migration baseline

The foundation maps the pre-existing `public.users` and `public.files` tables. It does not implement passwords/sessions or recipe functionality. Add those models through later reviewed migrations.

The configured project database was verified and baselined on November 7, 2026. Prisma reported no schema difference before and after baselining, and migration status is up to date. Existing application tables/rows were preserved; only Prisma migration metadata was created. The following workflows still apply to new databases or other branches.

`prisma7.config.ts` loads Next.js environment files. Prisma CLI uses `DIRECT_URL` if configured, otherwise `DATABASE_URL`; application requests always use `DATABASE_URL`. Keep both URLs pointed at the same intended database/branch. A direct URL is recommended for migration operations.

## New, empty development database

Set development credentials in `.env.local`, then:

```bash
npm run db:validate
npm run db:deploy
npm run storage:check
```

The initial migration creates only users and file metadata, including the existing positive file-size check. It does not create Blob objects or user accounts. Review the migration before executing it.

## Existing database with these tables

Do not run the initial CREATE TABLE migration against populated tables, use `db push`, or reset the database. First confirm the intended database and inspect its schema:

```bash
npm run db:diff
```

This is read-only. Exit 0 / no difference means the Prisma-representable schema matches; exit 2 means differences require investigation. Independently verify native constraints such as `files_size_positive`, because Prisma does not represent CHECK constraints in its schema language. Preserve any historical Drizzle migration metadata; it need not be removed.

Only after the existing tables and constraints match the initial migration, establish migration history:

```bash
npm run db:baseline
npm run db:status
```

`db:baseline` records `20261107000000_initial` as already applied. It creates/updates Prisma migration metadata; it does not execute the migration's table-creation SQL or modify application rows. Do not mark it applied on an empty or mismatched database.

## Future changes

Edit `schema.prisma`, then use `npm run db:migrate -- --name descriptive_change` against a development database. Review SQL and commit the migration with the schema. Apply reviewed migrations to other environments using `npm run db:deploy` as a separate release step. Setup, installation, and builds never run migration commands.

The CLI, client, and adapter are pinned to Prisma 7.10.1. The current Better Auth Prisma guide supports Prisma 7 and does not support Prisma 8 yet. Check compatibility before upgrading majors. See [Better Auth Prisma integration](https://better-auth.com/docs/adapters/prisma).
