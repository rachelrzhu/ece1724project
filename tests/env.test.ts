import assert from "node:assert/strict";
import { test } from "node:test";
import { readEnvironment } from "../lib/env";

test("blank cloud settings allow frontend-only setup", () => {
  assert.equal(readEnvironment({ DATABASE_URL: "  " }).DATABASE_URL, undefined);
});

test("database URLs must name a PostgreSQL database", () => {
  for (const value of ["https://example.com/db", "postgresql://localhost/", "not-a-url"]) {
    assert.throws(() => readEnvironment({ DATABASE_URL: value }), /DATABASE_URL/);
  }
  assert.equal(readEnvironment({ DATABASE_URL: " postgresql://localhost/recipe " }).DATABASE_URL, "postgresql://localhost/recipe");
});

test("validation errors do not echo a credential-bearing URL", () => {
  const secret = "https://fixture:do-not-print@localhost/private";
  assert.throws(() => readEnvironment({ DATABASE_URL: secret }), (error: Error) => !error.message.includes("do-not-print") && !error.message.includes(secret));
});

test("Google credentials must be paired and configured secrets must be long enough", () => {
  assert.throws(() => readEnvironment({ GOOGLE_CLIENT_ID: "fixture" }), /both Google/);
  assert.throws(() => readEnvironment({ BETTER_AUTH_SECRET: "short" }), /at least 32/);
  assert.doesNotThrow(() => readEnvironment({ GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture" }));
});

test("auth URL accepts an application origin and rejects credentials or non-HTTP schemes", () => {
  assert.doesNotThrow(() => readEnvironment({ BETTER_AUTH_URL: "http://localhost:3002" }));
  for (const value of ["file:///tmp/app", "https://user:secret@example.com"]) {
    assert.throws(() => readEnvironment({ BETTER_AUTH_URL: value }), /BETTER_AUTH_URL/);
  }
});
