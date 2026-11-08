# Development, preprod, and production

| Stage | Git branch | Vercel target | Purpose |
| --- | --- | --- | --- |
| Dev | `dev`, or a feature branch merged into `dev` | Local Development / Preview | Build and test ongoing work. |
| Preprod | `preprod` | Preview, with branch-specific credentials | Test a release through its Vercel URL before it goes live. |
| Prod | `main` | Production | Serve https://ece1724project.vercel.app. |

Keep `main` as Vercel's Production Branch. A separate `prod` branch is unnecessary: `main` is prod. Branch previews work on Vercel Hobby; paid Custom Environments are optional.

## Release workflow

1. Work locally on `dev` or on a feature branch. If you already have uncommitted work, save it on your current branch before switching. Never discard it to change environments.
2. Push feature work and open a pull request into `dev`, or push ongoing work to `dev`.
3. Open a pull request from **dev to preprod**. Check the changes, let `check`, `release-path`, and `Vercel` pass, and merge it.
4. Open the **preprod branch deployment** in Vercel. Test the homepage, health endpoint, and any changed authenticated features using preprod data. A passing build does not replace testing the actual page.
5. Open a pull request from **preprod to main**. Let the required checks pass and merge only after you have tested preprod. This is the deliberate production release step.
6. After a release, bring `main` back into `dev` (`git switch dev`, `git merge origin/main`, then `git push origin dev`). Before a later dev-to-preprod PR, also merge `origin/preprod` into `dev` if GitHub requests an update. Use merge commits for these long-lived branches; keep them after merging.

Protected `main` and `preprod` require a pull request, an up-to-date branch, passing application checks, the correct source branch, and a successful Vercel build. Admins must follow these rules too. Dev allows direct pushes; all three branches reject force pushes and deletion. The initial setup creates dev and preprod without changing main or publishing unfinished local work.

`npm run check` validates Prisma, lints, checks TypeScript, and runs automated tests. CI also builds the app. `vercel.json` repeats these checks before Vercel can accept a build. The production build guard rejects production builds whose Git branch is not `main`. A manual **Promote to Production** action can bypass branch-based release flow; reserve the Vercel dashboard for reviewed releases and rollback.

## Vercel settings

In the existing **ece1724project** project:

1. **Settings → Environments → Production**: verify Production Branch is `main`. Keep the existing production domain assigned here.
2. **Preview**: allow deployments from `dev`, `preprod`, and feature branches. Use the branch-specific URLs shown on each deployment for persistent dev/preprod links. No custom domain purchase is required.
3. **Settings → Environment Variables**: scope credentials separately using the table below. For Preview, set the **Git Branch** to `dev` or `preprod` when their values differ. Unqualified Preview variables also apply to other feature branches; give those development credentials only.
4. Leave Preview deployment protection enabled. Changing credentials requires a new deployment.
5. For an additional manual release gate, disable **Auto-assign Custom Production Domains** under Production Branch Tracking. New production builds then need explicit promotion. This is optional; do not promote a Preview build that was built with development credentials.

GitHub branch protection controls merges into `main`. Vercel's own branch/domain settings determine where traffic goes; creating a GitHub environment alone does not configure Vercel.

## Isolate data as well as pages

| Setting | Development / generic Preview | Preprod branch Preview | Production |
| --- | --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Development database/Neon branch | Separate preprod database/Neon branch | Production database/Neon branch |
| `BLOB_READ_WRITE_TOKEN` | Development Blob store | Separate preprod Blob store | Production Blob store |
| `BETTER_AUTH_SECRET` | Development-only secret | Unique preprod secret | Unique production secret |
| `BETTER_AUTH_URL` | Local/dev URL | Preprod URL | Production domain |
| Google OAuth credentials | Dev application/allowed redirects | Preprod application/allowed redirects | Production application/allowed redirects |

Use independent database credentials and Blob stores. Separate page URLs do not protect production data when credentials are shared. Do not copy Production secrets into Preview or `.env.local`. Keep credential files ignored by Git. When authentication is implemented, configure its redirects for the appropriate environment.

Leave `NODE_ENV` to Next.js: local `next dev` uses `development`; **both** Preview and Production builds use `production`. `NODE_ENV=preprod` and `.env.preprod` are not supported stage selectors. Vercel supplies `VERCEL_ENV` (`preview` or `production`) and `VERCEL_GIT_COMMIT_REF` to distinguish deployments. `.env.local` is for local development credentials.

Database migrations stay manual and environment-specific. Installation, CI, and Vercel builds generate the Prisma client but never run `prisma migrate deploy`. Review SQL, verify the target database and backup, and follow [the database workflow](../prisma/README.md). Apply additive changes in dev, then preprod, then production; a code rollback cannot undo a database change.

## Rollback

If a production release fails, open Vercel → Deployments and use **Instant Rollback** on the last known-good production deployment. Then fix the problem in dev and repeat the release flow. Avoid promoting an arbitrary dev/preprod build because its environment variables and resources can differ from production. Never force-push main as a rollback.

## Reference

- [Vercel environments and branch previews](https://vercel.com/docs/deployments/environments)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
