# Confirmed architecture

Rachel confirmed Prisma on November 7, 2026. The revised proposal selects HeroUI. This replaces the earlier pending ORM decision; the November 6 setup review is historical.

## Application shape

Use one Next.js App Router modular monolith with React and TypeScript, Tailwind 4/HeroUI 3, Neon PostgreSQL through Prisma 7, private Vercel Blob, and Vercel hosting. Keep the existing root-level app/ and lib/ conventions. Better Auth, Zod input schemas, and a Redux Toolkit scaling workspace form the feature plan.

Server Components read through server-only queries/services. Server Actions and Route Handlers call the same services, validate inputs, and enforce session/ownership/visibility rules. The browser never accesses database/storage credentials. HTTP endpoints are used for auth callbacks, media delivery, and operations that need an HTTP interface.

Prisma CLI, client, and adapter are pinned to compatible 7.10.1 versions. Use one schema/migration owner. The current users/files tables are preserved through mapped models and a verified migration baseline, not recreated. Better Auth's schema and the recipe domain will be added later.

## Important boundaries

- Store original recipe quantities persistently. A pure TypeScript engine computes scaled display values; browser scaling does not mutate the recipe.
- Share recipe-scoped state across serving controls, ingredient constraints, quantities, warnings, undo, and reset. Use selectors and coherent transitions. Avoid a server-global Redux singleton and clear stale state on recipe changes.
- Store photo bytes in private Blob and metadata/ownership/recipe links in PostgreSQL. A media route must enforce public/private recipe visibility. Owner-only generic downloads cannot serve public recipe photos.
- Multi-row recipe creation/forking uses a database transaction. Blob operations need compensating cleanup and cannot share that transaction.
- Bookmarks are references. Forks are independent new private recipes with provenance. P1 image-copy semantics remain to be finalized.
- Structured ingredient/allergen relations support declared conflict detection; missing mappings do not establish safety. Keep allergies distinct from dietary preferences.

## Current foundation versus planned features

Implemented foundation: Prisma client/configuration, mapped starter models and initial migration, environment template/validation, setup tooling, read-only cloud checks, HeroUI styles, health endpoint, and tooling tests/CI.

Not implemented: Better Auth flows, recipe models/workflows, upload UI, visibility-aware media route, bookmarks, scaling engine/workspace, and dietary discovery. Installing foundational packages does not establish those capabilities.

Development setup generates the Prisma client and prepares local configuration. Migration commands are explicit. Production deployment and cloud account provisioning are outside the current setup task.

## Team and implementation sequence

Rachel leads backend; Grace leads frontend. Rachel independently originated the idea from daily-life needs. The revised proposal and requirements backlog govern feature scope. Integrate authentication and create/view first, then recipe lifecycle/photos/discovery/bookmarks, then scaling and shared state. P1 waits for a stable MVP.


