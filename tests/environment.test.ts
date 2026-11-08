import { describe, expect, it } from "vitest";
import { readBlobEnvironment, readDatabaseEnvironment } from "@/lib/config/env";

describe("database configuration", () => {
  it("accepts PostgreSQL and returns only the required setting", () => {
    expect(readDatabaseEnvironment({ DATABASE_URL: "postgresql://localhost/recipes", PRIVATE_TOKEN: "hidden" }))
      .toEqual({ DATABASE_URL: "postgresql://localhost/recipes" });
  });

  it.each([undefined, "", "https://example.com/database", "postgresql:///", "invalid-secret-value"])("rejects an invalid URL without echoing it: %s", (DATABASE_URL) => {
    expect(() => readDatabaseEnvironment({ DATABASE_URL }))
      .toThrow("Set DATABASE_URL to a valid PostgreSQL connection URL in .env.local.");
  });
});

describe("private Blob configuration", () => {
  it("requires a token without including configuration values in errors", () => {
    expect(() => readBlobEnvironment({})).toThrow("Set BLOB_READ_WRITE_TOKEN in .env.local");
    expect(() => readBlobEnvironment({ BLOB_READ_WRITE_TOKEN: " " })).toThrow();
  });

  it("returns only the server token", () => {
    expect(readBlobEnvironment({ BLOB_READ_WRITE_TOKEN: "test-token", OTHER: "private" })).toEqual({ BLOB_READ_WRITE_TOKEN: "test-token" });
  });
});
