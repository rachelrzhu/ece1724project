# Requirements and sequenced backlog



Related documents: [proposal](proposal.md), [architecture decision](architecture.md), [setup review](setup-review.md).

## Product goal and ownership

Help cooks create, discover, save, and adapt recipes to their portions and available ingredients. Personalized dietary discovery and independent forks are the next delivery priorities. Rachel originated the idea from daily-life needs and leads backend work; Grace leads frontend work. Both review and integrate each workflow.

P0 is the committed working baseline. P1 is planned after P0 stabilizes. P2 is outside the committed schedule. These are proposed planning priorities pending approval.

Two deliberate refinements to the brief: make coordinated reset/undo state part of P0 to substantiate the second advanced feature; move optional step photographs to P1 so cover-image integration is completed first. Forks and dietary discovery retain their P1 status. If either becomes essential to the presentation, explicitly promote it and remove equivalent work elsewhere.

## P0 functional requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| AUTH-01 | Register, sign in, sign out using Better Auth | Email/password and Google flows resolve a stable application user; session survives refresh; logout invalidates access. Errors do not expose credentials or provider internals. |
| AUTH-02 | Enforce permissions on the server | An unauthenticated request cannot mutate data. A second account cannot edit/delete another user's recipe or attach its files. Private recipes are absent from public queries and inaccessible by guessed IDs. |
| REC-01 | Create/edit a recipe | Persist title, description, positive base servings, nonnegative prep/cook minutes, difficulty, ordered ingredients, and ordered steps. Validation rejects incomplete required fields; a failed write leaves no partial child rows. |
| REC-02 | Control visibility/delete | A recipe defaults to private until explicitly published. Only its author can change visibility/delete it. Related records are handled intentionally; public-to-private changes remove access from discovery, bookmarks, direct reads, and media delivery. |
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
- Use one selected ORM and migration owner. Database records come from generated/inferred ORM types; server inputs use Zod schemas.
- Authenticate and authorize at every service boundary. Derive user identity from verified sessions; ignore client-supplied owner IDs.
- Keep secrets out of Git, client bundles, URLs, logs, and screenshots. Commit a blank `.env.example` after architecture determines the required variables.
- Create/update related recipe rows atomically. Blob operations use compensating cleanup and cannot be part of a PostgreSQL transaction.
- Keep Preview/development resources distinct from Production before mutation-heavy testing. The current dashboard connects the same stores to Preview and Production; actual branch/credential isolation has not been established.
- Bound form lengths, ingredient/step counts, image sizes, pagination, and scaling inputs. Avoid shared caching of private records/media.
- Do not add a separate Express/FastAPI service, Redis, queues, or microservices without a concrete requirement.

## Course alignment and evidence

The [official handout](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/) accepts the selected technology categories and lists both proposed advanced-feature categories. Qualification depends on implemented depth; library installation is not evidence. Basic uploads do not count as an advanced feature.

| Area | Planned evidence | Current status |
| --- | --- | --- |
| Required frontend/server stack | Responsive recipe views; Server Component reads, actions, and routes | Framework/components exist; recipe workflows absent. |
| Relational persistence | Schema/migrations and database-backed recipe workflow | Users/files tables reachable; recipe models absent. |
| Cloud file handling | Real photo upload, record association, authorized delivery | Helpers tested; live connectivity passes; browser workflow absent. |
| Advanced feature 1 | Session flows and two-user access-control demonstration | Better Auth absent. |
| Advanced feature 2 | Shared scaling controls, selectors, mode changes, reset/undo, state tests | Engine/store absent. |

Do not count Google OAuth separately from authentication to satisfy the second feature. Image transformation could be a later additional feature, but is not needed for the proposed two-feature plan.

## Sequenced backlog

Items are local planning records, not published GitHub issues. Each implementation item becomes a small feature branch/PR after approval. Owner means lead; both members review integrated behavior.

| Order / ID | Target | Work and exit condition | Lead | Depends on |
| --- | --- | --- | --- | --- |
| 01 / PLAN-01 | Nov 6–8 | Confirm monolith, ORM, media policy, and scope; resolve proposal draft choices. | Rachel + Grace | Confirmed November 7 |
| 02 / FOUND-01 | Nov 9 | Review existing changes, select compatible versions, document environment placeholders and test-resource isolation. Commit baseline only after review. | Rachel | PLAN-01 |
| 03 / DB-01 | Nov 9–10 | Adopt chosen ORM; preserve users/files; validate compatible identity IDs and transaction rollback; add recipe schema/migrations and seed conventions. | Rachel | FOUND-01 |
| 04 / UI-01 | Nov 9–11 | Agree on service/input contracts; build navigation and accessible editor/detail skeletons using existing shadcn components. | Grace | PLAN-01; contracts with DB-01 |
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

Final-report target: at most 5,000 words, clear setup and user guide, individual contributions, verification/AI evaluation, and a `Video Demo` link. Keep 2–4 representative AI interactions in `ai-session.md`, including decisions and verification. Record this planning session honestly: Rachel originated the idea; AI helped draft/review; architecture remains pending. Preserve the November 26 presentation snapshot independently of later improvements. Ensure graders can access a private repository.

## Next authorized boundary

Rachel confirmed Prisma on November 7 and supplied a revised proposal selecting HeroUI. Foundation setup and validation are authorized. Continue with the backlog after the setup is verified; do not treat authentication, recipe workflows, or scaling as implemented. Cloud account creation, production deployment, and pushing commits are outside this setup task.
