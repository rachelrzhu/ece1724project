# ECE1724 Project Proposal: Recipe Sharing and Adaptive Ingredient Scaling

**Team:** Rachel — backend lead; Grace — frontend lead.

## 1. Motivation

Home cooks often find recipes that do not match the number of people they are feeding or the ingredients they have available. Adapting quantities manually can introduce arithmetic errors, while saving recipes across browser bookmarks and personal notes makes modifications difficult to track. Dietary preferences introduce another discovery problem: ingredient information is often unstructured, making it difficult to identify declared conflicts consistently.

We propose a responsive recipe application that combines a personal recipe collection with interactive ingredient scaling. Its primary users are home cooks preparing small, variable-sized meals. A user could find a recipe for four people, adjust it for six, or calculate a smaller batch using ingredients already in their kitchen. They could bookmark the original or, in a subsequent milestone, create an editable personal copy.

The application will explain its limits. Adjusting quantities will not imply that cooking time or temperature changes proportionally. Dietary filtering will identify declared ingredient conflicts without guaranteeing that a recipe is free from allergens or cross-contact.

## 2. Objectives, Architecture, and Key Features

### 2.1 Objectives and scope

Our first objective is a complete workflow: sign in, create a recipe with a cover photograph, publish it, discover another user's recipe, save it, and interactively adjust its quantities. Our second objective is dependable engineering: persistent data, server-enforced permissions, validated input, accessible feedback, and meaningful tests.

The committed MVP will include:

- Google OAuth and email/password authentication, logout, and persistent sessions.
- Recipe creation, editing, deletion, and public/private visibility.
- Structured ingredients, ordered instructions, servings, preparation/cooking times, and difficulty.
- A cover photograph stored in cloud storage and associated with its recipe.
- Public recipe browsing, basic title/ingredient search, and personal bookmarks.
- Scaling by target servings or the available amount of one selected ingredient.
- Shared scaling controls, derived quantities, warnings, reset, and undo.
- Responsive mobile and desktop views, loading/error states, and a deployed demonstration.

After stabilizing this workflow, our next priorities are independent recipe forks and personalized discovery using structured allergens and dietary preferences. Tag/time/difficulty filters and step photographs follow. Shopping lists, meal planning, comments, nutrition estimation, and AI recipe generation are outside the committed scope. This staged plan lets two students verify the central workflow before expanding it.

### 2.2 Architecture and technology

We will use **Option A: a Next.js full-stack modular monolith**. TypeScript will be used throughout the application; React, Tailwind CSS, and **HeroUI** will provide the interface. One application keeps deployment and integration manageable while feature modules separate business logic from presentation. It avoids maintaining a second backend service for functionality Next.js provides directly.

Server Components will load authorized data through server-only query helpers. Server Actions will handle mutations. Route Handlers will serve authentication callbacks, recipe images, and other HTTP-specific operations. Both entry points will call shared services rather than duplicating authorization rules. The browser will never receive database or storage credentials.

**Neon PostgreSQL and Prisma** will provide relational persistence and typed database access. The main entities will be User, Recipe, Ingredient, RecipeIngredient, InstructionStep, SavedRecipe, Allergen, UserAllergy, and IngredientAllergen, alongside authentication records and image metadata. A recipe belongs to one author and contains ordered ingredient entries and steps. Bookmarks form a unique user/recipe relationship. An optional parent recipe records fork provenance; deleting an original will not delete its independent forks.

**Vercel Blob** will store photograph bytes; PostgreSQL will store object paths, type, size, ownership, and recipe associations. Private object storage will deliver images through a server route that checks recipe visibility. Visitors must be able to view public recipe images, while private images remain restricted. Uploads will validate image contents and enforce size limits. Storage and database operations require compensating cleanup because they cannot share one transaction.

For recipe creation, the server will validate the form with Zod, resolve the signed-in user, save the recipe and ordered children atomically, associate an owned uploaded photograph, and refresh the affected view. Discovery queries will exclude inaccessible recipes before filtering and pagination. A bookmark remains a reference to its author's recipe; a fork creates new editable rows under the copying user's account and defaults to private.

The interface will prioritize clear serving controls, readable ingredient quantities, accessible forms, and visible validation/pending states. Editing and scaling will be distinct so a temporary portion adjustment cannot silently overwrite the original.

### 2.3 Advanced features and core logic

**Authentication and authorization:** Better Auth will provide Google OAuth, email/password credentials, and sessions. Every protected read or mutation will verify permissions on the server. Tests will attempt edits, private image reads, and collection access using a second user's identity. Hiding controls will never substitute for authorization.

**Advanced state management:** Redux Toolkit will coordinate the shared scaling workspace. Serving controls, ingredient constraints, the ingredient table, derived serving count, warnings, and reset/undo controls will use shared state and selectors. Mode changes and undo must restore consistent values across these components. A session will be scoped to its recipe and reset appropriately on navigation. This demonstrates coordinated state transitions and computed state beyond an isolated serving counter.

The scaling engine will be a pure TypeScript module. Serving mode uses `targetServings / originalServings`; ingredient mode uses `availableQuantity / originalRequiredQuantity`. Every result will be calculated from unchanged original values. For example, 400 g of flour for four servings becomes 600 g for six. A recipe needing 450 g can be reduced by a factor of `250 / 450` when only 250 g is available.

The initial unit model will support compatible mass and volume conversions, separate count units, and unquantified entries such as “to taste.” It will reject incompatible conversions and nonpositive/nonfinite inputs, preserve precision until display, and warn about fractional whole ingredients. It will not convert mass to volume without density information or scale cooking time and temperature automatically.

Personalization will use explicit ingredient/allergen relationships and user preferences rather than keyword-based safety claims. Unknown mappings will remain visible as incomplete information. Ordinary uploads are core functionality, not an additional advanced feature; Google OAuth belongs to authentication.

### 2.4 Verification and feasibility

Vitest will cover scaling arithmetic, conversions, invalid inputs, state transitions, and important service behavior. Database integration tests will check ownership, visibility, bookmark uniqueness, and transaction rollback. Browser checks will exercise the two-user workflow and responsive layouts. Lint, type checks, production builds, and continuous integration will catch problems early.

The principal risks are OAuth configuration, image visibility, and sufficient depth in shared state. We will address these through early integration, concrete acceptance criteria, and focused tests. Vercel will host the application; Neon and Blob will provide its data services. We will use development resources for testing and check usage allowances before expanding the demo dataset. P1 features will be deferred if they threaten the MVP.

## 3. Project Plan and Team Responsibilities

| Dates in 2026 | Planned outcome |
| --- | --- |
| By November 8 | Finalize requirements, architecture, responsibilities, and proposal. |
| November 9–13 | Complete initial database design, authentication, and an integrated create/view recipe workflow. |
| November 14–18 | Complete recipe lifecycle, visibility, cover uploads, discovery, and bookmarks; integrate both members' work. |
| November 19–23 | Complete scaling and shared state; test edge cases; attempt forks and dietary discovery after the MVP is stable. |
| November 24–26 | Freeze a stable demonstration, prepare the introduction/slides, and rehearse the live workflow. |
| November 27–December 3 | Verify permissions and responsive layouts, fix defects, finish documentation, and record the demo. |
| December 4–6 | Verify clean-checkout setup, complete final checks, and submit. |

Rachel will lead schema/migrations, authentication integration, permissions, storage services, recipe transactions, scaling calculations, and backend tests. Grace will lead layout, accessibility, recipe discovery/detail/editor views, photograph previews, shared scaling interactions, and frontend tests. Both will implement code, review changes, integrate features, and prepare the demonstration and documentation.

We will agree on input schemas and service contracts before building connected interfaces, use feature branches and pull requests, and keep `main` deployable. Each workflow will be integrated before the next milestone. Presentation material will reflect the November 26 snapshot; later development will be documented separately.

## 4. Initial Team Reasoning and AI-Assisted Exploration

### 4.1 Initial reasoning and project origin

Rachel originated the project from needs in her daily life and selected its core ideas. The initial problem framing was practical recipe management and adaptation: a useful application should help users work with different serving sizes, available ingredients, and dietary restrictions. The initial technical approach was a Next.js monolith with relational recipe data and separate photograph storage. Rachel will mainly focus on backend work, with Grace mainly focusing on frontend work.

Questions investigated during planning included whether the selected data services fit a small cloud-hosted application, how images should follow recipe visibility, and whether scaling could demonstrate meaningful advanced state management.

### 4.2 Exploration and evaluation

AI assistance helped compare database and UI options, review the plan against course requirements, and inspect the development setup. The resulting choices are Prisma with Neon, HeroUI with Tailwind, and one Next.js application. We evaluated these choices against the intended workflow, integration effort, and two-person schedule. The project concept and scope originated with Rachel; AI supported technical review and documentation.

One refinement concerned image permissions: owner-only downloads cannot support visitors viewing public recipe photographs. The revised design checks recipe visibility before serving image bytes. Another was to treat scaling as coordinated state with selectors, mode changes, warnings, and undo/reset, rather than assuming that installing Redux establishes sufficient complexity. Course and provider documentation informed these refinements. Permission, state-transition, and database tests will verify implementation rather than accepting it solely because AI suggested it.

References: [Course overview](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/overview/) and [project guidelines](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/).
