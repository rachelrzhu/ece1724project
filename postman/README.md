# Test recipe CRUD with Postman

The development collection exercises recipe and image endpoints using a fixed account. It runs against an isolated schema and removes the records it creates. Keep an existing tester schema if you want to reuse it.

## Start the tester

Set `DATABASE_URL` in `.env.local`. From the repository root, run

```bash
npm run backend-test:setup
npm run dev -- --hostname 127.0.0.1
```

## Run the development collection

**In Postman**, import [the CRUD collection](crud.postman_collection.json).

1. Set the collection variable `baseUrl` to the server’s loopback origin, such as `http://127.0.0.1:3000`, without a trailing slash.
2. Set Postman’s working directory to the repository root. Request 29 sends `README.md` as a fake image. If Postman cannot find it, select the file in the request’s form-data body.
3. The default run sends 33 requests. To include all 44, set `BLOB_READ_WRITE_TOKEN` on the server and the collection variable `runImageTests` to `true`. Request 34 uploads `tests/fixtures/storage-sample.png`.
4. Run one iteration in collection order. Let the collection continue after a failed assertion so the cleanup requests can run. Each run uses IDs returned by earlier requests.

**From the terminal**, install the [Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection) and make sure `postman` is on your PATH. Keep the server running and use a second terminal in the repository root. These commands use the local collection file and can run without a Postman login.

```bash
npm run test:postman
# Include the image requests
npm run test:postman -- --env-var runImageTests=true
# Use a different server port
npm run test:postman -- --env-var baseUrl=http://127.0.0.1:3002
```

The collection checks ingredient and step order, decimal quantities, unmeasured ingredients, visibility, and cover ownership. It also checks invalid IDs and inputs, upload and request size limits, and Host and Origin restrictions. Error cases assert the expected 400, 403, 404, 409, or 413 response. Tester responses must include `Cache-Control: no-store`.

If a run stops early, use the IDs in its responses to remove leftover records through the tester. Run `npm run backend-test:cleanup` only when you want to remove the **whole sandbox**. Cleanup needs a Blob token if the sandbox still has file records.

## Check that production disables the tester

Start a local production build on port 3001. This check can run without cloud credentials or a tester schema.

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3001
```

From another terminal, run `npm run test:postman:production`, or import the [production guard collection](production-guards.postman_collection.json) and run it against that instance. All seven tester API operations should return JSON 404 responses before accessing storage or the database. Check the `/backend-test` page separately. It should also return 404.

CI runs the credential-free Vitest suite. For a manual check of two-user permissions and transaction rollback, `npm run storage:check` uses two test identities in a disposable schema. [Recorded CRUD review results](../docs/crud-review.md)
