# Postman CRUD checks

Import `crud.postman_collection.json` into Postman, or run it with the installed [Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection). The collection is saved in Git so both teammates use the same requests and assertions. Local CLI runs do not require a Postman login; cloud publication is not configured.

## Start the development tester

From the project root, with `DATABASE_URL` configured in `.env.local`:

```bash
npm run backend-test:setup
npm run dev -- --hostname 127.0.0.1
```

Setup creates a separate sandbox schema. Do not remove an existing sandbox just to run the collection: successful runs remove only their own generated recipe/image IDs. The fixed test identity exercises local services, not product authentication.

## Run in the Postman app

1. Import `crud.postman_collection.json` and select the collection's variables.
2. Set `baseUrl` to the development server's exact loopback origin, for example `http://127.0.0.1:3000`, with no trailing slash.
3. Set Postman's local working directory to this repository. Request 29 uploads `README.md` to verify that fake image content is rejected. If the app cannot resolve the relative path, select that file manually in its form-data body.
4. Leave `runImageTests` as `false` for the 33-request database/validation suite. For the full 44-request run, configure `BLOB_READ_WRITE_TOKEN` on the server and set `runImageTests` to `true`. Request 34 uses `tests/fixtures/storage-sample.png`; select this file manually if necessary.
5. Run the **entire collection in order**, with one iteration and without stopping on assertion failure. Later requests use the IDs captured by earlier requests, then delete those records.

The collection covers create/list/read/update/delete, ordered ingredient/step replacement, decimal precision, unquantified notes, visibility changes, invalid IDs/input/ownership fields, body limits, Host/Origin checks, malformed uploads, and optional image attachment/read/delete behavior. Negative cases expect 400, 403, 404, 409, or 413 as appropriate. Responses must use `Cache-Control: no-store`.

## Run from the terminal

Keep the development server running in another terminal, then run from the repository root:

```bash
npm run test:postman
# Include the real private-image round trip:
npm run test:postman -- --env-var runImageTests=true
# Override the server port if needed:
npm run test:postman -- --env-var baseUrl=http://127.0.0.1:3002
```

The CLI executable `postman` must be on your PATH; it is not an npm dependency. These checks are manual because they require a running server and development database. Credential-free Vitest checks remain in CI.

If a run is interrupted, its generated IDs are visible in its responses. Remove only those test records through the tester, or remove the entire sandbox with `npm run backend-test:cleanup` when you no longer need **any** of its data. Image records require Blob credentials for cleanup; a database-only sandbox with no recorded images can be cleaned up without a Blob token.

## Check the production guards

Build and start a local production instance on a separate port:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3001
```

In another terminal:

```bash
npm run test:postman:production
```

Alternatively, import `production-guards.postman_collection.json` into Postman and run it against that instance. All seven supported tester API operations must return JSON 404 responses before using database/Blob services. The `/backend-test` page must also return 404. Production checks do not need sandbox setup or cloud credentials. Running this guard collection against a development server intentionally fails.

Two-user service permissions and transaction rollback are also checked by `npm run storage:check` in a fresh disposable schema. Those checks inject test identities; real Better Auth session flows remain future work. Recorded review results are in [the CRUD review report](../docs/crud-review.md).
