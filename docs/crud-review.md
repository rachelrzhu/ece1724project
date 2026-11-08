# CRUD implementation review

Reviewed November 8, 2026. The local recipe CRUD implementation is ready for teammate review and publication. It provides owner-scoped listing, creation, detail reads, transactional updates, and deletion through a development-only integration tester. Product authentication and product screens remain separate work.

## Findings and fixes

1. **Malformed multipart uploads returned 500.** The upload route now uses a shared bounded multipart parser and returns 400 for malformed data or a non-file image field. Unit and Postman cases verify the behavior.
2. **Deletion initialized the database before validating its ID.** UUID validation now runs before database initialization. A regression test verifies invalid edit/delete input does not touch the database.
3. **Database-only sandbox cleanup unnecessarily required Blob credentials.** Cleanup now works without a Blob token when the sandbox has no file records. If records exist, it refuses cleanup and preserves the schema/configuration until credentials are supplied. Both paths were verified with a separately created disposable sandbox.

The reviewed services reject client-supplied ownership, require a session reader for mutations, enforce author predicates, check cover eligibility, and replace ordered children inside one transaction. A live failure injected into a replacement step verified that the recipe and all previous child rows remain unchanged after rollback. Recipe deletion cascades to children/bookmarks and deliberately retains independently owned file records for explicit image cleanup.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Schema validation, lint, TypeScript, and all 72 Vitest tests pass. |
| Full Postman development collection | 44 requests, 135 assertions; no failures. Includes recipe lifecycle, validation, request limits, image upload/association/read/delete, and cleanup. |
| Default Postman run without image uploads | 33 requests, 103 assertions; no failures. The 11 optional image lifecycle requests are skipped. |
| Postman production guards | All 7 supported tester API operations return 404; 21 assertions pass. |
| Production build/page smoke check | `npm run build` passes; `/backend-test` returns 404 and `/api/health` returns `{"status":"ok"}`. |
| `npm run storage:check` | All 17 live checks pass, including real CRUD services, two-identity authorization, update rollback, cascading deletion, and Blob round trip. |
| Cleanup without Blob credentials | Empty-file sandbox cleans up; a sandbox with file records is preserved and reports the missing token. |
| Existing development data | The same four original recipe IDs remain after the full Postman run. Only generated test recipes/images were deleted. |

See [Postman instructions and collections](../postman/README.md) and the [credential-free live report](storage-test-results.json). Postman runs use local collection files; no account/workspace upload is configured.

## Boundaries

The tester uses one fixed identity in an isolated schema, restricts requests to loopback development origins, and returns 404 in production. Postman therefore does not demonstrate real sign-in or two authenticated browser sessions; the separate live service tests inject two identities. Better Auth integration, product endpoints/screens, public/private recipe-aware image delivery, and production image reconciliation remain open on the [project roadmap](https://github.com/rachelrzhu/ece1724project/issues/1). No application-table migrations were applied during this review.
