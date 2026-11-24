# Recipe CRUD review

The November 8, 2026 review covered listing, creating, reading, editing, and deleting recipes through the local development tester. Postman used a fixed account in a separate database schema. The storage checks used two test identities to exercise ownership rules. Browser sign-in and production image cleanup were outside this review. [Project roadmap](https://github.com/rachelrzhu/ece1724project/issues/1)

## Fixes from the review

1. Malformed uploads returned 500. The upload route now returns 400 for invalid multipart data or an image field containing text. Both unit tests and Postman cover these cases.
2. Deleting a recipe initialized the database client before checking its ID. The service now validates the UUID first. A regression test covers both edit and delete.
3. Cleaning up a database-only sandbox required a Blob token. Cleanup now checks for file records first. If any exist and the token is missing, it keeps the schema and local configuration so the cleanup can be retried.

The recipe service takes the owner ID from the session and checks that the author owns the cover. A forced error while replacing a step rolled back the entire edit, preserving the recipe, ingredients, and steps. Deleting a recipe removed its children and bookmarks. Its cover file stayed available for a separate cleanup.

## Results on November 8

| Check | Result |
| --- | --- |
| `npm run check` | Prisma validation, lint, TypeScript, and all 72 Vitest tests passed. |
| Default Postman collection | 33 requests and 103 assertions passed. The 11 optional image requests were skipped. |
| Postman with images enabled | 44 requests and 135 assertions passed, including upload, cover assignment, retrieval, and cleanup. |
| Production guard collection | All seven tester API operations returned 404. All 21 assertions passed. |
| Production smoke check | `npm run build` passed. `/backend-test` returned 404 and `/api/health` returned `{"status":"ok"}`. |
| `npm run storage:check` | All 17 checks passed, including two-user permissions, transaction rollback, cascading deletion, and a private Blob upload and read. |
| Cleanup without a Blob token | A sandbox with no file records was removed. A sandbox containing file records was preserved and reported the missing token. |
| Existing data | All four pre-existing recipe IDs were still present after the full Postman run. The run removed its own recipes and images. |

The review ran without applying migrations to application tables. To reproduce the API checks or inspect the storage results, see the [Postman instructions](../postman/README.md) and [storage test report](storage-test-results.json).
