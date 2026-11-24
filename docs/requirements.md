# Requirements and project backlog

## Product goal and ownership

Cooks should be able to save a recipe and adjust it to the number of servings they need or the amount of an ingredient they have. Rachel proposed the idea and leads the backend. Grace leads the frontend. Both review each workflow together. [Project proposal](proposal.md)

P0 is the proposed scope for the demo. It includes cover photos and two scaling controls with shared undo and reset. Editable copies and dietary filters are the first P1 priorities. Step photos can wait until cover uploads work end to end. Promoting a P1 feature means choosing which other work to defer. P2 falls outside the current schedule.

## P0 functional requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| AUTH-01 | Register, sign in, sign out using Better Auth | Email/password and Google flows resolve a stable application user; session survives refresh; logout invalidates access. Errors do not expose credentials or provider internals. |
| AUTH-02 | Enforce permissions on the server | An unauthenticated request cannot mutate data. A second account cannot edit/delete another user's recipe or attach its files. Private recipes are absent from public queries and inaccessible by guessed IDs. |
| REC-01 | Create/edit a recipe | Persist title, description, positive base servings, nonnegative prep/cook minutes, difficulty, ordered ingredients, and ordered steps. Validation rejects incomplete required fields; a failed write leaves no partial child rows. |
| REC-02 | Control visibility/delete | A recipe defaults to private until explicitly published. Only its author can change visibility/delete it. Deleting a recipe removes its ingredients, steps, and bookmarks and retains its independently owned file record. Making it private removes access for other users from discovery, bookmarks, direct reads, and media delivery. |
| IMG-01 | Upload and display a cover photo | Signed-in owner uploads a supported image, bounded to 3 MiB. Inspect actual image contents and reject unsupported/empty/oversized files. Persist metadata and a recipe association; another user's upload cannot be attached. Display a placeholder when no cover exists. |
| IMG-02 | Apply recipe visibility to photos | Visitors can view public recipe images. Only the owner can view private images. Blob credentials remain server-only. A failed metadata write triggers cleanup; unattached/deleted images have a documented cleanup path. |
| DISC-01 | Browse/search public recipes | Paginated results contain only public recipes. Search supports title and canonical ingredient names; query parameters survive refresh. Show loading, empty, and failure states. Parameterize queries and bound page size. |
| COLL-01 | Manage owned recipes/bookmarks | Show separate owned and saved views. Saving is idempotent through a unique user/recipe constraint. Saving a reference conveys no edit rights; original edits remain visible. Inaccessible recipes reveal no private metadata. |
| SCALE-01 | Scale by target servings | For base servings 4 and flour 400 g, target 6 displays 600 g. Target must be finite and positive. Scaling changes display only; repeated adjustments always recompute from original values. |
| SCALE-02 | Scale by one available ingredient | For base flour 450 g and available flour 250 g, factor is 250/450. Display derived ingredient quantities and implied servings. Reject an unavailable/unquantified constraint, zero denominator, nonpositive/nonfinite inputs, and incompatible units. |
| STATE-01 | Coordinate the scaling workspace | Serving input, constraint selector, ingredient rows, serving summary, and warnings update consistently from shared state. Reset restores original configuration; undo restores the previous configuration across all controls. Switching recipes clears stale state. |
| UX-01 | Provide usable responsive flows | Verify narrow mobile and desktop layouts, labeled controls, keyboard interaction, visible focus, actionable form feedback, and loading/error states. Confirm no horizontal overflow in ingredient tables or editor forms. |
| OPS-01 | Verify/reproduce the app | Lint/type/build checks pass; meaningful tests cover business rules and two-user authorization. Provide environment placeholders, migrations, seed/demo data, setup instructions, and a usable deployment. Deployment is a project goal. |

## Scaling rules

- Store original quantities independently of scaling state. Persist decimal quantities; convert into a documented representation at the engine boundary.
- Support a bounded unit catalog: mass, volume, and count. Convert only within compatible dimensions, such as kg↔g and L↔mL. Adopt explicit teaspoon/tablespoon conventions before enabling those conversions.
- Do not infer grams from cups without a known ingredient density. Preserve unfamiliar units and explain why constraint conversion is unavailable.
- Allow null quantity and descriptive notes for “to taste.” Such entries stay unchanged and cannot drive constraint scaling.
- Scale count ingredients mathematically but warn about impractical fractions, such as 0.6 eggs. Do not silently round them and change the ratio.
- Keep full computational precision until formatting; document display rounding separately. Cooking time and temperature remain unchanged, accompanied by an explanation.
- Start with one ingredient constraint at a time. Multiple simultaneous pantry constraints are outside P0.
- Keep engine functions independent of React, Redux, authentication, and database code. Test exact examples, conversions, reversibility, and invalid inputs.

## P1 and P2 scope

| ID | Priority | Requirement | Acceptance criteria / boundary |
| --- | --- | --- | --- |
| FORK-01 | P1 | Independently editable fork | Signed-in user copies an accessible public recipe into new private recipe/ingredient/step rows in one database transaction. Record parent provenance. Source edits/deletion do not alter fork contents. Proposed first release omits photos with a clear notice; confirm before implementing. |
| PREF-01 | P1 | Structured dietary preferences/allergens | User can maintain preferences and declared allergens. Ingredient-to-allergen joins drive exclusion/flagging. Test at least one multi-allergen ingredient. Unknown/unmapped content remains identified as incomplete. |
| DISC-02 | P1 | Additional discovery filters | Combine tags, difficulty, and total preparation/cooking-time filters with pagination and visibility rules. Define tag assignment explicitly; a missing allergen link does not prove a dietary tag. |
| IMG-03 | P1 | Optional step images | Associate ordered steps with validated, authorized image assets; bound individual and aggregate upload sizes. Reordering/deleting steps does not leak or orphan image associations. |
| FUT-01 | P2 | Shopping lists, meal plans, ratings/comments, AI import/generation, substitutions, nutrition | No committed implementation before P0 and selected P1 features are stable. |

Personalization must describe detected conflicts and data limitations. Do not label results “allergy safe,” infer medical suitability, or conflate dietary choices with diagnosed allergies.

## Engineering constraints

- Keep server and browser application code in TypeScript. Reuse Tailwind/HeroUI and existing root-level application conventions.
- Use Prisma for database types and migrations. Validate incoming recipe data with Zod.
- Authenticate and authorize at every service boundary. Derive user identity from verified sessions; ignore client-supplied owner IDs.
- Keep secrets out of Git, client bundles, URLs, logs, and screenshots. List the required variable names in `.env.example` with any secret values blank.
- Create/update related recipe rows atomically. Blob operations use compensating cleanup and cannot be part of a PostgreSQL transaction.
- Use separate database and Blob resources for development, preprod, and production. Check the selected credentials before running tests that write data. See the [deployment guide](deployment.md).
- Bound form lengths, ingredient/step counts, image sizes, pagination, and scaling inputs. Avoid shared caching of private records/media.
- Do not add a separate Express/FastAPI service, Redis, queues, or microservices without a concrete requirement.

## Course alignment and evidence

The [course handout](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/) lists authentication and coordinated application state as advanced-feature categories. The demo needs to show each feature working. Google sign-in belongs to authentication. Basic uploads meet the file-handling requirement.

The [architecture](architecture.md) describes how the product screens, recipe services, and data model fit together.

| Area | Implementation and local evidence | Evidence still needed for the demo |
| --- | --- | --- |
| Frontend and server | Responsive recipe and account screens use Server Component reads, Server Actions, and authentication and image routes. Local browser checks cover desktop and mobile layouts. | Run the recipe workflow on the deployed app. |
| Relational persistence | Prisma migrations cover users, authentication, recipes, ingredients, steps, bookmarks, and file metadata. The November 8 review checked CRUD and rollback in a disposable PostgreSQL schema. | Check the target database’s migration history and run the deployed workflow. |
| Cloud files | The November 8 review tested private Blob upload, read, and deletion. Local browser checks cover image upload and visibility changes with the local media adapter. | Verify a cover upload and access from a second browser account on preprod. |
| Advanced feature 1 — authentication | Better Auth handles email/password accounts and database sessions. Tests cover Google callbacks, and local checks exercise two-account permissions and sign-out. | Verify Google consent and session restoration on the preprod origin. |
| Advanced feature 2 — scaling state | The recipe-scoped Redux workspace shares serving and ingredient settings, warnings, undo, and reset. Unit tests cover calculations and state transitions. | Demonstrate both modes and their shared history with the deployed demo recipes. |

## Sequenced backlog

The table records the original November delivery plan. The lead coordinates each item and both teammates review the integrated result. Current issue states and owners are on the [GitHub roadmap](https://github.com/rachelrzhu/ece1724project/issues/1) and [milestones](https://github.com/rachelrzhu/ece1724project/milestones).

| Order / ID | Target | Work and exit condition | Lead | Depends on |
| --- | --- | --- | --- | --- |
| 01 / PLAN-01 | Nov 6–8 | Confirm monolith, ORM, media policy, and scope; resolve proposal draft choices. | Rachel + Grace | Confirmed November 7 |
| 02 / FOUND-01 | Nov 9 | Review existing changes, select compatible versions, document environment placeholders and test-resource isolation. Commit baseline only after review. | Rachel | PLAN-01 |
| 03 / DB-01 | Nov 9–10 | Adopt chosen ORM; preserve users/files; validate compatible identity IDs and transaction rollback; add recipe schema/migrations and seed conventions. | Rachel | FOUND-01 |
| 04 / UI-01 | Nov 9–11 | Agree on service/input contracts; build navigation and accessible editor/detail skeletons using HeroUI components. | Grace | PLAN-01; contracts with DB-01 |
| 05 / AUTH-03 | Nov 10–12 | Integrate Better Auth, Google callback configuration, protected sessions, and matching auth views; prove two-user isolation. | Rachel + Grace | DB-01, UI-01 |
| 06 / REC-03 | Nov 12–15 | Deliver create→view→edit→delete with visibility and child-row transactions. Integrate form errors and permission failures. | Rachel + Grace | AUTH-03 |
| 07 / IMG-04 | Nov 14–16 | Integrate cover uploads, recipe association, visibility-aware image delivery, and cleanup; complete a cloud round trip. | Rachel + Grace | REC-03 |
| 08 / DISC-03 | Nov 16–18 | Public browse/search, owned list, bookmarks, and revoked-access behavior. | Grace (UI), Rachel (queries) | REC-03; integrate IMG-04 |
| 09 / SCALE-03 | Nov 18–20 | Implement pure scaling engine, explicit units/rounding policy, and edge-case tests. | Rachel | Approved ingredient contract from DB-01 |
| 10 / STATE-02 | Nov 19–22 | Connect engine to recipe-scoped Redux workspace; implement both modes, warnings, undo/reset, and transition tests. | Grace | SCALE-03, detail view |
| 11 / MVP-01 | Nov 22–23 | Run two-user browser workflow, image authorization, responsive checks, and deployed smoke test. Fix P0 failures before expanding scope. | Both | Items 05–10 |
| 12 / P1-01 | After MVP gate | Attempt forks first, then dietary discovery; take step images/extra filters only if capacity remains. | Both | MVP-01; explicit P1 scope review |
| 13 / DEMO-01 | Nov 24–26 | Prepare fixed demo dataset, introduction/slides, technical explanation, and live-demo rehearsal. Freeze presentation evidence. | Grace coordinates; both contribute | MVP-01; completed P1 only |
| 14 / FINAL-01 | Nov 27–Dec 6 | Stabilize, verify setup from clean checkout, finish README and AI record, record demo, check repository access, submit. | Both | DEMO-01 |

Integration checkpoints: a signed-in recipe creation by November 13; core data/image/collection flows by November 18; scaling and P0 acceptance by November 23; presentation-ready snapshot by November 26. If a checkpoint slips, defer P1 rather than skipping permissions, testing, or integration.

## Submission calendar and records

Verified against the [course overview](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/overview/) and handout on November 6, 2026. Official deadlines are **11:59 PM Toronto time** (8:59 PM Los Angeles on these dates). Check Quercus for submission-specific updates.

| Date | Required record/action |
| --- | --- |
| November 8 | Each member submits the same proposal Markdown file; maximum 2,000 words. |
| November 18 | Each member completes the confidential team health check. |
| November 25 | Each member submits the 70–100-word introduction. |
| November 26 | Each member submits the same slides; freeze work shown in presentation. |
| November 27 / December 4 | Assigned presentation session; check assignment and attendance instructions. |
| December 6 | Repository submission with source, README final report, AI record, demo video, and deployment link if applicable. |

Final-report target: at most 5,000 words, clear setup and user guide, individual contributions, verification/AI evaluation, and a `Video Demo` link. Keep 2–4 representative AI interactions in `ai-session.md`, including decisions and verification. Record the project origin and assistance accurately: Rachel originated the idea; AI helped draft/review; the architecture document records the selected design and implementation status. Preserve the November 26 presentation snapshot independently of later improvements. Ensure graders can access a private repository.

## Implementation status

Chrome checks against disposable PostgreSQL cover search and pagination, registration and sign-out, recipe editing and deletion, saved recipes, cover uploads and visibility changes, scaling controls, and layouts down to 350 px. The browser checks use the repository’s local media adapter. The standalone real Blob round trip and automated Google callback tests provide separate evidence for those service boundaries.

The integrated preprod smoke test with Google OAuth and Vercel Blob remains open. Release through the [deployment workflow](deployment.md) and verify against preprod resources before promoting to production.
