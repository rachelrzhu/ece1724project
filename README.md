# From My Kitchen

From My Kitchen is a recipe-sharing app for home cooks. You can save a recipe once and adjust it to the number of people at the table or the amount of an ingredient you have. If a four-serving recipe calls for 400 g of flour and you have 200 g, the app shows the quantities for two servings. The original recipe stays available for the next time you cook.

[Open the live app on Vercel](https://frommykitchen.vercel.app/) · [Run it locally](#development-guide)

## Features and user guide

| What you want to do | How to do it |
| --- | --- |
| Find a recipe | Open **Find recipes** in the top navigation and search by title or ingredient. Switch between **Cards** and **List**, or select a cook’s name to see their public recipes. |
| Choose a language | Use **EN**, **FR**, or **中** in the header. The site starts in a supported browser language and remembers your choice across visits. |
| Change the appearance | The moon or sun button in the header switches between light and dark mode. The site follows your device setting until you choose one. On a phone, open the menu beside the site name to browse recipes or reach your account. |
| Read a recipe in your language | On supported desktop Chrome installations, recipe titles, descriptions, notes and steps translate on your device. Chrome may ask you to enable a language model on first use. **Show original** restores the cook’s wording. If translation is unavailable, you can still read the original recipe. |
| Find or exclude an ingredient | **Egg**, **鸡蛋**, and **œuf** match the same catalog ingredient in search and filters. Catalog ingredient names are available in all three languages, including when a device cannot translate recipe text. |
| Find something quick | Enter your available minutes in **Ready in** and choose **Search**. A 30-minute limit includes 30 minutes exactly. The filter uses combined prep and cook time or a published total-time estimate. Recipes with unknown times appear when you leave the limit blank. |
| Adjust a batch | Open a recipe and choose **By servings** or **By ingredient**. Enter your target servings or the quantity and unit you have. The measured ingredients update together. **Undo** restores the previous adjustment and **Reset** returns to the original quantities. Cooking times and instructions stay as written. |
| Write and publish | Sign in, choose **Share a recipe**, and add servings, ingredients, ordered steps, and an optional cover photo. Recipes start private. Choose public visibility to share one, or open **My recipes** to edit or delete it. |
| Save or adapt someone’s recipe | Bookmark a public recipe to find it under **Saved**. Choose **Make an editable copy** to get a private copy of its ingredients and steps. You can edit the copy and add your own cover. Signed-in cooks can also like or dislike recipes. |
| Filter ingredients | In **Find recipes**, open **More filters** to exclude allergens or an ingredient by name, then choose **Apply filters**. Saved dietary preferences from **Account** also appear here. Remove an applied filter individually or use **Clear filters** to reset the search and filters together. |
| Manage your profile | Register with email and password, or use Google sign-in when configured. In **Account**, edit your display name, username, and avatar or open your recipe page. |

## Stack and architecture

| Layer | Implementation |
| --- | --- |
| Web app | Next.js 16 App Router, React 19, and TypeScript. Next.js renders the pages, handles form submissions through Server Actions, and serves the authentication and image routes. |
| Interface and scaling | Material Tailwind React and Tailwind CSS 4 for the interface. Each open recipe has a Redux Toolkit store that coordinates the scaling controls, quantities, warnings, and undo history. |
| Database and accounts | Prisma 7 with PostgreSQL, hosted on Neon for deployments. Better Auth stores accounts and sessions in PostgreSQL. The server checks the cook’s identity and recipe visibility before serving private content. |
| Images | Sharp validates uploads. Vercel Blob stores private images in hosted environments. The local demo stores images on disk. |

For ECE1724, the recipe editor demonstrates relational create, read, update, and delete operations, and cover uploads demonstrate cloud file handling. Authentication and the shared state behind ingredient scaling are the two advanced features. [Architecture](docs/architecture.md) · [Course requirement mapping](docs/requirements.md#course-alignment-and-evidence)

## Development guide

### 1. Download the code

Install **Node.js 24.x** with npm and **PostgreSQL 18** with the server tools. Check that `node --version`, `initdb --version`, and `pg_ctl --version` work in your terminal. You need an internet connection to install dependencies the first time. [Node.js downloads](https://nodejs.org/en/download) · [PostgreSQL downloads](https://www.postgresql.org/download/)

Clone the development branch and enter the project folder.

```sh
git clone --branch dev https://github.com/rachelrzhu/ece1724project.git
cd ece1724project
```

You can also choose **Code → Download ZIP** on the development branch, extract it, and open a terminal in the folder containing `package.json`. [Development branch on GitHub](https://github.com/rachelrzhu/ece1724project/tree/dev)

### 2. Start the local demo

From a fresh checkout, run the following as your regular user. The setup script creates its own `.env.local`.

```sh
npm ci
npm run poc:setup
npm run poc:dev
```

`npm ci` installs the locked dependencies and generates the Prisma client. The setup command creates an authentication secret, starts PostgreSQL on port `55432`, applies the migrations, and seeds recipes, covers, and demo accounts. The app uses port `3100`. Both ports must be free. This setup works without cloud credentials.

### 3. Try a recipe

Open the app at **http://127.0.0.1:3100**. Choose **Find recipes** and open a recipe to try both scaling modes. To try publishing and bookmarks, choose **Sign in**. Use either local demo account, `rachel@savor.local` or `grace@savor.local`, with the password `SavorKitchen2026!`.

To stop, press **Ctrl+C** in the app terminal, then run `npm run poc:stop-db`. Recipes and images persist in `.local-poc/`. To resume, run `npm run poc:setup` followed by `npm run poc:dev`.

### Use hosted services locally (optional)

In a separate fresh checkout, run `npm run setup -- --install-only` to install dependencies and create `.env.local`. Set `DATABASE_URL` to a development PostgreSQL database and `DIRECT_URL` to its direct connection for migrations. For hosted image uploads, set `BLOB_READ_WRITE_TOKEN` to the token for a private development Blob store. Setup generates `BETTER_AUTH_SECRET` and sets `BETTER_AUTH_URL` to `http://localhost:3000`. Optional Google sign-in also needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a registered callback. [Environment template](.env.example) · [Google sign-in configuration](docs/deployment.md#google-sign-in)

For an empty development database, run `npm run db:migrate`, then `npm run dev` and open [localhost:3000](http://localhost:3000). For a populated database, follow the baselining instructions first. If setup reports a Next.js lock, stop the server or build using that checkout. After a crash, confirm the process has stopped before clearing its generated `.next` directory. [Database setup](prisma/README.md) · [Deployment guide](docs/deployment.md)

<a id="everyday-use"></a>

### Run the checks

- `npm run check` validates the Prisma schema, runs ESLint and TypeScript, and executes the Vitest suite, including migration tests.
- With the seeded local app running, run `npm run poc:verify` in a second terminal to check sign-in, recipe access, and cover visibility over HTTP.
- For the two-account browser test, run `npx playwright install chromium` once, then `npm run test:product` against the running local demo.

<a id="simple-local-backend-tester"></a>

The separate development-only backend tester supports manual recipe and image requests. The Postman guide covers setup, sample requests, and cleanup. [Run the backend tester](postman/README.md#start-the-tester)

## Team and contributions

| Team member | Student number | Preferred email | Contribution |
| --- | --- | --- | --- |
| Rachel | | | Proposed the project and led backend development, including recipe persistence, private image storage, and access checks with two accounts. [Recipe and storage implementation](https://github.com/rachelrzhu/ece1724project/commit/5b59965) · [Two-account verification](https://github.com/rachelrzhu/ece1724project/commit/7d66df0) |
| Grace | | | Led frontend development, including recipe discovery, navigation, and the Redux controls that scale ingredients on the recipe detail page. [Discovery interface](https://github.com/rachelrzhu/ece1724project/commit/0b5b83d) · [Scaling interface](https://github.com/rachelrzhu/ece1724project/commit/06367d2) |

## AI assistance, verification, and lessons learned

The team used AI to compare storage and database options and review the design. During that review, the team caught a flaw in the proposed image permissions. An owner-only rule would hide a published recipe’s cover from its readers. The image route now checks who can see the associated recipe. [Project proposal](docs/proposal.md#42-exploration-and-evaluation)

The owner can see the cover in both visibility settings, so checking with the owner alone would miss this bug. The browser test uses a second account to bookmark a public recipe, then checks that the reader loses access to the bookmark listing, recipe, and cover when the author makes it private. [Browser check](scripts/check-product.mjs) · [Recorded integration tests](docs/crud-review.md)

The separate `ai-session.md` with the team’s representative AI interactions is pending for final submission. [Course final report guidelines](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/#final-report)

## Video Demo

<!-- Add the URL of the team's 2–5 minute narrated walkthrough here. -->

## License

The project code is licensed under the [MIT License](LICENSE). For third-party recipes and photographs, see the [source and attribution notes](public/images/SOURCES.md).
