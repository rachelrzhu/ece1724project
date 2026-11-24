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
6. After a release, fetch the latest branches and merge the released commit into `dev`.

   ```bash
   git fetch origin
   git switch dev
   git merge --ff-only origin/dev
   git merge origin/main
   git push origin dev
   ```

   If GitHub requests an update on a later dev-to-preprod PR, repeat the sequence with `git merge origin/preprod` in place of `git merge origin/main`. Use merge commits for PRs between these long-lived branches and keep the branches after merging.

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

Use independent database credentials and Blob stores. Separate page URLs do not protect production data when credentials are shared. Do not copy Production secrets into Preview or `.env.local`. Keep credential files ignored by Git.

Leave `NODE_ENV` to Next.js: local `next dev` uses `development`; **both** Preview and Production builds use `production`. `NODE_ENV=preprod` and `.env.preprod` are not supported stage selectors. Vercel supplies `VERCEL_ENV` (`preview` or `production`) and `VERCEL_GIT_COMMIT_REF` to distinguish deployments. `.env.local` is for local development credentials.

Database migrations stay manual and environment-specific. Installation, CI, and Vercel builds generate the Prisma client but never run `prisma migrate deploy`. Review SQL, verify the target database and backup, and follow [the database workflow](../prisma/README.md). Apply additive changes in dev, then preprod, then production; a code rollback cannot undo a database change.

Before promoting a release with schema changes, run `npm run db:status` against the destination database and compare its migration history with the release. Apply the pending migrations there before switching traffic. Verify email registration and a session refresh on the deployed origin. The health endpoint can return 200 while registration fails because its database tables or columns are missing.

When rotating a nonproduction Neon password or Blob token, update the corresponding Vercel Preview values and any `preprod` branch overrides that reference the rotated credential. These values are copies of the provider credentials. Verify their branch scopes, redeploy each affected preview, and check its homepage and `/api/health` through authenticated preview access.

### Isolation verification on November 8, 2026

Dev and preprod each started with an empty Neon database and a separate private Blob store. The baseline and recipe migrations applied to both databases. All 17 live database and storage checks passed in each environment, and the checks removed their disposable schemas and objects. Both protected previews returned HTTP 200 for the homepage and health endpoint and HTTP 404 for the local-only backend tester. Production retained its existing database, store, and deployment throughout the verification.

## Google sign-in

1. In Google Cloud Console, select the project and open **Google Auth Platform**. Under **Branding**, enter the app name and support and developer contact emails. Under **Audience**, choose **External** for testers from different Google domains. While using the **Testing** audience, add the demo accounts under **Test users**.
2. Under **Clients**, create a **Web application** OAuth client for development. Register the local and dev redirect URIs below under **Authorized redirect URIs**. Create separate clients for preprod and production, each with its own URI. The callback includes the full path. [Google web application setup](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) · [Better Auth Google provider](https://better-auth.com/docs/authentication/google)

| Client | Authorized redirect URI |
| --- | --- |
| Development, local | `http://localhost:3000/api/auth/callback/google` |
| Development, Vercel Preview on `dev` | `https://ece1724project-git-dev-rachelrzhus-projects.vercel.app/api/auth/callback/google` |
| Preprod, Vercel Preview on `preprod` | `https://ece1724project-git-preprod-rachelrzhus-projects.vercel.app/api/auth/callback/google` |
| Production | `https://ece1724project.vercel.app/api/auth/callback/google` |

3. In local `.env.local`, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the development client and `BETTER_AUTH_URL=http://localhost:3000`. If you run locally at another origin, register its exact callback and use that origin in the app. Configure the local database with the auth migration and a `BETTER_AUTH_SECRET` of at least 32 characters.
4. In Vercel **Project Settings → Environment Variables**, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `BETTER_AUTH_URL` in each intended target. Use Preview with the **Git Branch** set to `dev` or `preprod`, and the production client with the Production target. Set `BETTER_AUTH_URL` to the origin in the matching table row (omit the callback path). Keep the client secret server-only and retain each target's database and auth secret.
5. Redeploy the affected branch after saving its settings. Open its stable URL, authenticate to Vercel if Preview protection is enabled, and click **Continue with Google**. Confirm that the correct email appears after return and refresh, then sign out. Repeat with **Cancel** at Google's consent screen and confirm the app offers another attempt.

## Rollback

If a production release fails, open Vercel → Deployments and use **Instant Rollback** on the last known-good production deployment. Then fix the problem in dev and repeat the release flow. Avoid promoting an arbitrary dev/preprod build because its environment variables and resources can differ from production. Never force-push main as a rollback.

## Reference

- [Vercel environments and branch previews](https://vercel.com/docs/deployments/environments)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
