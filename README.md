# ECE1724 Project

Recipe sharing and adaptive ingredient scaling, built with Next.js, React, TypeScript, Tailwind CSS, and HeroUI. The implementation includes a Prisma/PostgreSQL foundation, recipe models, validated recipe services, private-image upload/read services, and automated checks. Better Auth persists sessions in PostgreSQL. A local backend tester exercises recipe and image services.

See the [system architecture](docs/architecture.md), [requirements](docs/requirements.md), and [database workflow](prisma/README.md) for implementation details and status.

For safe releases, use **dev → preprod → main (prod)**. See the [deployment guide](docs/deployment.md) for branches, Vercel settings, separate credentials, and rollback.

## First-time setup (no web development experience needed)

### 1. Install Node.js 24

Download and install **version 24 LTS** from [the official Node.js website](https://nodejs.org/en/download). Choose version 24 in the version selector even if a newer version is shown first. Choose the installer for your laptop and include **npm**, which installs the project's packages.

Close and reopen your terminal after installation. A terminal is the app where you type commands: **Terminal** on macOS/Linux or **Command Prompt / Windows Terminal** on Windows.

### 2. Download the project

On this project's GitHub page, choose **Code → Download ZIP**, then extract the ZIP completely. You can also clone the repository if you already use Git. Open the extracted project folder: it should contain `package.json`, `setup.command`, and `setup.cmd`.

### 3. Run setup

| Your laptop | What to do |
| --- | --- |
| macOS | Double-click `setup.command`. If it cannot open, open Terminal in the project folder and run `sh setup.command`. |
| Windows | Double-click `setup.cmd` in the extracted folder. |
| Linux | Open a terminal in the project folder and run `npm run setup`. |

The same terminal command also works on macOS and Windows:

```bash
npm run setup
```

To open a terminal in the right folder, use your editor's **Open Folder** and then **Terminal → New Terminal**. Alternatively, type `cd ` followed by the project folder's path, putting the path in double quotes if it contains spaces.

Setup checks Node.js and npm, installs the exact packages listed in `package-lock.json`, generates the Prisma client, prepares `.env.local` if missing, and starts the app. An internet connection is needed for installation and the first run, including downloading Google fonts. No Vercel login, PostgreSQL installation, Docker, or credentials are required for the placeholder or automated checks. Setup does not apply database migrations.

### 4. Open the app

Wait until the terminal says **Ready**, then open the **Local** address it prints, normally [http://127.0.0.1:3000](http://127.0.0.1:3000). You should see **Hello world**.

If another program uses port 3000, Next.js normally chooses the next available port. Always use the address printed in your terminal.

Keep the terminal open while using the app. Press **Ctrl+C** to stop it.

## Frontend and backend

Next.js runs the frontend and its server-side code together. **You only need one command and one terminal**; there is no separate backend server to install or start.

- The frontend homepage is in `app/page.tsx`.
- `app/api/health/route.ts` serves `GET /api/health`, a liveness endpoint that returns `{ "status": "ok" }` without checking cloud services.
- `lib/db/client.ts` creates the server-only Prisma client lazily. `prisma/schema.prisma` defines profiles, file metadata, recipes, ingredients, steps, and bookmarks.
- `lib/recipes/` contains Zod input contracts and owner-scoped creation, detail, listing, update, and delete services. Product Server Actions use the Better Auth session reader to authorize recipe and bookmark changes.
- `lib/storage/` validates actual image content, writes private Blob objects and file metadata, compensates failed writes, and provides owner-scoped reads.
- `/backend-test` is a temporary development-only interface for recipe CRUD and image uploads. The application has no product sign-in, editor, or scaling interface yet. Setup does not provision cloud services.

An existing `.env.local` is left untouched. Setup copies `.env.example` only if `.env.local` is missing. Database features use `DATABASE_URL`; private image services also require `BLOB_READ_WRITE_TOKEN`. Get development credentials from the project owner and keep them in `.env.local`, which is ignored by Git. The authentication API uses `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`.

Migrations are explicit. Read the [database workflow](prisma/README.md) before running `npm run db:migrate`, especially against an existing database with `users` and `files` tables. The automated tests use isolated in-memory PostgreSQL and do not access Neon or Blob.

## Everyday use

After the first setup, open a terminal in the project folder and run:

```bash
npm run dev
```

Edit `app/page.tsx` and save; the browser updates automatically. Stop the server with **Ctrl+C**. If a teammate changes the project's dependencies, stop the server and run `npm run setup` again to reinstall them.

Other useful commands:

```bash
npm run setup -- --install-only   # Install packages without starting the app
npm run setup -- --port 3002      # Install and start on a specific port
npm run dev -- --port 3002        # Start on that port without reinstalling
npm run lint                     # Check code style and common mistakes
npm run typecheck                # Generate route types and check TypeScript
npm test                         # Run input, service-boundary, and migration tests
npm run check                    # Validate schema, lint, typecheck, and run tests
npm run build                    # Check that a production build succeeds
```

The launchers can be run from any working directory. The `npm run ...` commands must be run from the folder containing `package.json`. Setup intentionally does not change your system settings or install Node.js for you.

## Simple local backend tester

Prepare a separate test schema once, then start the development server:

```bash
npm run backend-test:setup
npm run dev -- --hostname 127.0.0.1
```

Open [http://127.0.0.1:3000/backend-test](http://127.0.0.1:3000/backend-test). Use **Add ingredient** to enter more ingredients, or **Remove** beside a row to delete it. Each ingredient has its own quantity, unit, and optional note; leave quantity blank and add a note for entries such as “salt to taste.” The form supports up to 100 ingredients and one editable cooking step; additional saved steps are preserved. Use **Refresh / read**, **Create**, **Update selected**, **Delete selected**, and the image upload controls. Each action shows its HTTP status and JSON response.

This is an integration tool with a fixed test identity, not a sign-in flow. Its APIs use the existing recipe/image services against an isolated PostgreSQL schema. They accept local development requests only and return 404 in production. Existing application tables are unchanged. The test configuration stays in ignored `.backend-test.json`; test records persist between development-server restarts. The product frontend remains separate under `app/page.tsx` for continued frontend work.

Database credentials are required; image testing also needs the Blob token. To remove the tester's database schema, uploaded images, and local configuration:

```bash
npm run backend-test:cleanup
```

The test APIs are `GET/POST/PATCH/DELETE /api/backend-test/recipes` (use `?id=...` for a single recipe) and `GET/POST/DELETE /api/backend-test/images`. Writes require a matching `Origin` header, which the test page sends automatically.

Import the shared [Postman collections](postman/README.md) for repeatable CRUD and production-guard checks. With the development server running, `npm run test:postman` runs recipe/validation checks; append `-- --env-var runImageTests=true` to include image upload/read/cleanup. The Postman CLI must be installed separately. See the [CRUD review](docs/crud-review.md) for verification results.

## Manual live storage check

With database and Blob credentials configured, run:

```bash
npm run storage:check
```

This command writes disposable test data. It creates a uniquely named PostgreSQL schema, applies the migrations there, and tests real Prisma create/read/update/delete operations, transaction rollback, visibility, and bookmarks. It also uploads the sample PNG to private Blob storage, verifies its contents and access restrictions, modifies its file metadata, and removes the object and records. Cleanup removes the temporary schema and verifies that no sample Blob objects remain.

It does not modify public application tables or their migration history. The database role must be allowed to create a schema. This check is manual and is not part of setup or CI. It writes a credential-free report to [storage-test-results.json](docs/storage-test-results.json). See the [system architecture](docs/architecture.md) for current boundaries and remaining integration work.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `node` or `npm` is not recognized / not found | Install Node.js 24 with npm, then close and reopen the terminal. Check with `node --version` and `npm --version`. |
| The wrong Node.js version | Install/select Node.js 24. If you use nvm, run `nvm install` and `nvm use` in the project folder. |
| `npm.ps1 cannot be loaded` on Windows | Use `setup.cmd`, Command Prompt, or `npm.cmd run setup` in PowerShell. No execution-policy change is needed. |
| `package.json` cannot be found | Extract the ZIP and open a terminal in the project folder, not its parent folder. |
| Server already running | Use its existing browser page, or press Ctrl+C in that project's running terminal before running setup again. Setup refuses to reinstall packages while it detects an active development server. |
| Server lock after a crash | Close any running server for this project first. If the problem remains, delete only the generated `.next` folder in this project and rerun setup. Next.js will recreate it. |
| A specific port is busy | Use the next available port, for example `npm run setup -- --port 3002`. |
| Package download or font download fails | Check your internet connection, proxy, or VPN, then retry. If it persists, share the error message with a teammate. |
| Browser says it cannot connect | Keep the terminal running and use its printed Local address. Check the terminal for errors. |

If setup fails, it stops and prints a next step. It does not overwrite `.env.local` or change the dependency versions to try to fix the error.
