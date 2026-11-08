# ECE1724 Project Proposal: Recipe Sharing and Adaptive Ingredient Scaling

**Team:** Rachel — backend lead; Grace — frontend lead.

## 1. Motivation


We propose a recipe-sharing application where users can create, browse, and save recipes. Its main feature will automatically adjust ingredient quantities based on either the desired number of servings or the available amount of one selected ingredient. For example, a user could change a four-serving recipe to two servings, or halve a recipe that requires 400 g of flour when they have only 200 g. Users can bookmark recipes, with editable personal copies and dietary filtering planned as later features.

The application will adjust ingredient quantities while keeping the original cooking instructions. Users will be reminded that cooking time and temperature may need separate adjustments. If implemented, dietary filtering will flag listed ingredients that match a user’s restrictions, but it will not guarantee that a recipe is free from allergens or cross-contact.

## 2. Objectives, Architecture, and Key Features

### 2.1 Objectives and scope
Our first objective is to support a complete recipe-sharing workflow. Users will be able to sign in, create and publish a recipe with a cover photograph, browse other users’ public recipes, bookmark them, and adjust ingredient quantities. Our second objective is reliable data storage, secure access, and clear user feedback. The minimum viable product (MVP) will include:
- Sign-in through Google or email/password, logout, and sessions that keep users signed in between visits.
- Creating, editing, and deleting recipes, with public or private visibility.
- Separate ingredient entries with quantities and units, ordered cooking steps, serving counts, preparation and cooking times, and difficulty.
- One cover photograph per recipe, stored in cloud storage.
- Browsing public recipes, searching by title or ingredient, and bookmarking recipes.
- Adjusting ingredient quantities by the desired serving count or the available amount of one selected ingredient.
- Interactive scaling controls with warnings, undo, and reset.
- Layouts for mobile and desktop screens, clear loading and error messages, and an online demonstration.

Once the MVP is working reliably, we plan to let users create editable copies of other users’ recipes and filter recipes according to dietary preferences or listed allergens. Additional features may include filtering by tags, cooking time, or difficulty, and adding photographs to individual cooking steps. Shopping lists, meal planning, comments, nutrition estimates, and AI recipe generation are outside the planned scope. 

### 2.2 Architecture and technology
We will use **Option A: a Next.js full-stack application**, with TypeScript for both frontend and server code. React, Tailwind CSS, and HeroUI will provide the interface. Keeping the frontend and backend in one application will simplify development and deployment for our two-person team. We will organize the code into feature modules, separating interface components from database access and application rules.

Server Components will load recipe and account data after checking access permissions. Server Actions will handle changes such as creating, editing, and deleting recipes. Route Handlers will handle authentication callbacks and image requests. These parts will use shared server functions for permission checks and other application rules. Database and storage credentials will remain on the server.

We will use **Neon PostgreSQL** to store application data and **Prisma** to access it from TypeScript. The main records will represent users, recipes, ingredients, cooking steps, bookmarks, and photographs. Each recipe will belong to one user and contain an ordered list of ingredients and instructions. Each user will be able to bookmark a recipe once. Additional relationships for recipe copies and dietary filtering will be introduced if we implement those optional features.

**Vercel Blob** will store recipe photographs. PostgreSQL will store each photograph’s storage location, file type, size, owner, and associated recipe. Image requests will pass through a server route that checks the recipe’s visibility: anyone can view images belonging to public recipes, while private recipe images are available only to their owner. Uploads will be checked for valid image content and file size. We will also handle failures that could leave uploaded images without an associated recipe.

When a user creates a recipe, the server will check their identity and validate the submitted form using Zod. It will save the recipe, ingredients, and cooking steps in one database transaction and link a photograph owned by that user. Public browsing and search will return only public recipes. A bookmark will link to the existing recipe, and an optional personal-copy feature will create a separate editable recipe that is private by default. The interface will provide readable ingredient quantities, clear scaling controls, accessible forms, and visible loading and validation messages. Scaling will change the displayed quantities without saving changes to the original recipe. Editing a recipe will be a separate action.

### 2.3 Advanced features and core logic

**Authentication and authorization:** Better Auth will handle Google sign-in, email/password accounts, and user sessions. The server will check permissions whenever a user accesses protected data or makes changes. For example, users may edit only their own recipes and view only public recipes or private recipes they own. 

**Advanced state management:** Redux Toolkit will manage the recipe-scaling workspace. It will store the selected scaling mode, target servings, selected ingredient, available quantity and unit, and undo history. Shared selectors will calculate the scaling factor, adjusted ingredient quantities, resulting servings, and warnings. This will keep the serving controls, ingredient table, and warning messages consistent. Users can switch between scaling by servings and scaling by an available ingredient amount. Switching modes will preserve the current scaling factor. Undo will restore the previous scaling settings, while reset will return to the original recipe quantities. Opening a different recipe will initialize a new scaling workspace.

**Scaling calculations:** A separate TypeScript module will calculate quantities independently of the interface. In serving mode, the scaling factor will be `targetServings / originalServings`. In ingredient mode, it will be `availableQuantity / originalRequiredQuantity`, after converting both quantities to the same unit. All adjusted quantities will be calculated from the original recipe values to avoid accumulating rounding errors. For example, a recipe using 400 g of flour for four servings will require 600 g for six servings. If a recipe requires 450 g of flour but the user has only 250 g, the application will multiply ingredient quantities by `250 / 450`.

**Units and limitations:** The application will support conversions between a defined set of mass units and between a defined set of volume units. Counted ingredients, such as eggs, will scale numerically, with warnings for fractional amounts. Entries such as “salt to taste” will remain unchanged and cannot be used to calculate a scaling factor. The application will reject incompatible units, zero or negative quantities, and invalid numeric values. Calculations will retain precision until results are formatted for display. The application will not convert between mass and volume or automatically change cooking times and temperatures.

**Optional dietary filtering:** If implemented, dietary filtering will use recorded relationships between ingredients and allergens, together with user preferences. Ingredients without allergen information will be marked as unknown rather than treated as safe.

### 2.4 Verification and feasibility
Vitest will test scaling calculations, unit conversions, invalid inputs, and scaling state changes, including switching modes, undo, and reset. Database integration tests will verify that users can modify only their own recipes, private recipes remain restricted, duplicate bookmarks are prevented, and failed recipe creation does not leave partially saved records. Browser checks will use two accounts to exercise recipe creation, publishing, discovery, bookmarking, and scaling. We will also check layouts on mobile and desktop screen sizes. Automated checks will run through continuous integration when changes are pushed to GitHub. These checks will include linting, TypeScript type checking, automated tests, and a production build.

The main risks are configuring Google sign-in, protecting private recipe photographs, and implementing consistent behavior across the scaling controls. We will test sign-in and public/private image access early, before building the remaining features. Vercel will host the application, Neon will host the PostgreSQL database, and Vercel Blob will store photographs. We will keep test data small and check service storage and usage limits before adding more images. Optional features will be postponed if they put completion of the MVP at risk.

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
Rachel proposed the project based on difficulties she encountered when adjusting recipes in daily life. The initial idea was to let users save recipes and adjust ingredient quantities for different serving sizes or the amount of an ingredient they had available. Dietary filtering was also considered as a possible extension.
Our initial technical idea was to use Next.js for both the interface and server logic, a relational database for recipe information, and cloud storage for photographs. At this stage, we had not finalized the database provider, storage service, or details of the scaling interface.

We identified several questions for further investigation: 
- Which database and storage services would be manageable for our team? 
- How could public recipe photographs be accessible while private photographs remained protected? 
- Would the scaling interface involve enough shared state to satisfy the advanced state management requirement?

### 4.2 Exploration and evaluation
We used AI to compare database and interface options and review the proposed design against the course requirements. We selected Prisma with Neon for database access and hosting, HeroUI with Tailwind for the interface, and Next.js for the frontend and server code. We considered how these tools fit the application’s needs and the development workload for two students.

During the review, we identified a problem with image permissions. Restricting all image downloads to their owner would prevent other users from seeing photographs attached to public recipes. We changed the design so image access follows the associated recipe’s visibility: public recipe photographs are accessible to everyone, while private recipe photographs are restricted to their owner. We also refined the scaling interface. Using Redux alone would not demonstrate advanced state management. We therefore specified how serving controls, ingredient quantities, warnings, and undo/reset would share state and update together. We will test these interactions and permission rules during implementation.