# ECE1724 Recipe App

A recipe-sharing application for home cooks who need to adapt meals to their serving sizes and available ingredients. Users will create and discover recipes, save personal collections, and scale quantities without overwriting the original recipe.

Rachel originated the project from needs in her daily life and leads backend development. Grace leads frontend development. Both contribute implementation, review, integration, and testing.

## Project scope

The MVP includes Google/email authentication, recipe creation and public/private visibility, cover photographs, public search, bookmarks, and two scaling modes:

- **Target servings:** adjust a recipe for a different number of people.
- **Available ingredient:** scale using the amount of one ingredient on hand.

The scaling workspace will coordinate quantities, serving controls, warnings, reset, and undo. Independent forks and dietary/allergen discovery follow after the MVP is stable. Filtering identifies declared conflicts without guaranteeing allergen safety. Cooking time and temperature will not scale automatically.

**Current status:** development foundation. The homepage remains a placeholder. Prisma, environment tooling, cloud connectivity checks, and HeroUI styling are configured. Authentication, recipe workflows, uploads, and scaling are planned features.

## Architecture

| Layer | Technology |
| --- | --- |
| Application | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS 4 and HeroUI 3 |
| Server | Next.js Server Components, Server Actions, Route Handlers |
| Relational storage | Neon PostgreSQL through Prisma ORM 7 |
| Photographs | Private Vercel Blob; recipe-aware delivery planned |
| Authentication | Better Auth, Google OAuth, email/password — planned |
| Validation / shared state | Zod foundation; Redux Toolkit scaling workspace planned |
| Hosting | Vercel |

Next.js runs the frontend and server together; no separate backend is needed. Credentials stay on the server. Prisma 7 is pinned for compatibility with the planned Better Auth adapter. Upgrade the Prisma CLI, client, and adapter together after checking compatibility.

## First-time setup

1. Install **Node.js 24 with npm** from [Node.js](https://nodejs.org/en/download), or use `nvm install && nvm use`. Reopen your terminal after installation.
2. Clone the repository, or download and fully extract its ZIP.
3. Open the project folder in your editor, then open a terminal in that folder.
4. Run setup:

| Laptop | Launcher |
| --- | --- |
| macOS | Double-click `setup.command`, or run `sh setup.command`. |
| Windows | Double-click `setup.cmd`, or run `npm.cmd run setup`. |
| Linux | Run `npm run setup`. |

The shared command on all platforms is:

```bash
npm run setup
```

Setup checks Node/npm and running-process locks, installs locked dependencies, generates Prisma Client, creates or supplements `.env.local`, validates configured values, and starts Next.js. Existing environment values are preserved. A local auth secret is generated when its key is missing; an existing value, including an intentionally blank value, is never replaced.

Setup does not apply migrations, create cloud accounts, or upload data. The placeholder runs without cloud credentials. Internet access is needed for installation and the starter's Google fonts. Dependency install scripts have an explicit, version-pinned approval list for npm versions that support it.

Wait for **Ready**, then open the Local address printed by Next.js. Keep the terminal open and use **Ctrl+C** to stop it. If port 3000 is occupied, use the address printed in the terminal. Only one development server should run per checkout.

```bash
npm run setup -- --install-only  # Install/configure without starting
npm run setup -- --port 3002     # Install/configure on this port
npm run dev                     # Everyday use after setup
```

The launchers work from any working directory. The `npm run` commands must be run from the project folder.

## Environment configuration

`.env.example` is a safe template. Real values belong in Git-ignored `.env.local`. Do not commit/share that file or prefix secrets with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon runtime connection URL, including SSL settings. A pooled connection is suitable for application requests. |
| `DIRECT_URL` | Optional direct connection for migration commands; falls back to `DATABASE_URL`. |
| `BLOB_READ_WRITE_TOKEN` | Development private Blob store token. |
| `BETTER_AUTH_URL` | Future auth base URL; match the browser's actual origin and port. |
| `BETTER_AUTH_SECRET` | Future auth secret; setup generates a local value for a missing key. Use a different Production secret. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Future OAuth credentials. They do not enable sign-in before auth integration exists. |

Rachel should provide development access to Grace through a private channel. Keep development/Preview resources separate from Production. Set Production variables in Vercel; do not upload `.env.local`. The PostgreSQL adapter explicitly verifies server certificates.

```bash
npm run env:check      # Validate configured values; never print credentials
npm run storage:check  # Read-only Prisma/Blob connectivity and starter-table check
```

Environment checks permit absent cloud values for frontend-only work but reject malformed configured values. The cloud check requires both database and Blob credentials. It performs no uploads or record changes and is not an authentication or upload/download test.

## Prisma workflow

`prisma/schema.prisma` is the schema source. `prisma7.config.ts` loads the same environment-file convention as Next.js. Client generation and builds work without credentials. Initial models map existing `users`/`files` tables; recipe and Better Auth models will be added with their features.

```bash
npm run db:generate    # Generate client; no database writes
npm run db:validate    # Validate schema
npm run db:status      # Inspect migration status
npm run db:diff        # Read-only comparison; exit 2 means differences
npm run db:migrate -- --name add_recipe  # Development schema changes
npm run db:deploy      # Explicitly apply reviewed migrations
npm run db:studio     # Database editor; edits can change data
```

Use mutation commands only against the intended database. Existing tables need a verified migration baseline before applying the initial migration; never reset a populated database. See [Prisma initialization and baselining](prisma/README.md). Setup and builds never migrate automatically.

## Verification and structure

```bash
npm run check  # Lint, type-check, schema validation, tooling tests
npm run build  # Generate Prisma Client and build Next.js
```

Foundation tests cover setup arguments, environment preservation/validation, and server-lock handling. Recipe/authentication tests will be added with their features. CI runs the checks and build without cloud credentials. `/api/health` is liveness only; cloud diagnostics stay in the CLI.

Verification on November 7, 2026: all 12 tooling tests, lint, TypeScript, schema validation, read-only Prisma/Blob checks, and a production build passed. A fresh copy in a path containing spaces also completed the macOS launcher setup and build with no cloud credentials. Windows execution has not been tested on this Mac.

The dependency audit still reports 8 moderate and 4 high upstream findings in the ESLint/minimatch and Blob/CLI-config/Zod dependency chains. Next.js was updated to 16.4.5 to address its reported critical advisory. The remaining audit suggestions change framework-tooling or SDK versions; do not apply `npm audit fix --force` without compatibility review. Recheck upstream fixes before a public release.

```text
app/                  Pages, layout, styles, health endpoint, future routes/actions
lib/                  Environment validation and Prisma infrastructure
prisma/               Schema, reviewed migrations, database workflow
scripts/              Cross-platform setup and environment/cloud checks
tests/                Foundation/tooling tests
setup.command         macOS launcher
setup.cmd             Windows launcher
.env.example          Blank configuration template
```

Private planning files in `docs/` remain Git-ignored and are not needed to run the project. The final course submission will include a complete README report, AI interaction record, and demonstration video.

## Vercel deployment

Use the repository root, Next.js preset, Node 24.x, install command `npm ci --include=dev`, build command `npm run build`, and the default output directory. Configure environment variables for each deployment environment. Apply reviewed migrations separately to the intended database before releasing features that require them.

No deployment is triggered by local setup.

## Troubleshooting

| Problem | Next step |
| --- | --- |
| Node/npm missing or wrong version | Install/select Node 24, reopen the terminal, and check `node --version` / `npm --version`. |
| PowerShell blocks `npm.ps1` | Use `setup.cmd`, Command Prompt, or `npm.cmd`; no execution-policy change is needed. |
| Server already running | Stop it with Ctrl+C before setup reinstalls packages. Setup does not kill it. |
| Lock after a crash | Dead-PID metadata is accepted. For unreadable metadata, first stop this checkout's servers/builds, then remove only its generated `.next` folder. |
| Invalid environment setting | Correct the named key in `.env.local`; diagnostic messages do not print its value. |
| Database/Blob check fails | Check development credentials/network and migration status. Do not reset the database. |
| Port occupied | Try `npm run setup -- --port 3002`; align `BETTER_AUTH_URL` before testing auth. |
| Download/font failure | Check connection/proxy/VPN and retry. Setup does not silently change versions. |

Course references: [project overview](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/overview/) and [project guidelines](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/).
