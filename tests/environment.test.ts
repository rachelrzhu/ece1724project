import { describe, expect, it } from "vitest";
import { readBlobEnvironment, readDatabaseEnvironment, readEnvironment } from "@/lib/config/env";

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

describe("environment configuration check", () => {
  it("accepts blank optional settings and normalizes configured settings", () => {
    const config = readEnvironment({
      DATABASE_URL: "  ", DIRECT_URL: " postgresql://localhost/recipes ",
      BETTER_AUTH_URL: "http://localhost:3002", GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(config.DATABASE_URL).toBeUndefined();
    expect(config.DIRECT_URL).toBe("postgresql://localhost/recipes");
    expect(config.BETTER_AUTH_URL).toBe("http://localhost:3002");
  });

  it.each([
    ["DATABASE_URL", "not-a-url"],
    ["DIRECT_URL", "postgresql://user:private@localhost/"],
    ["BETTER_AUTH_URL", "file:///tmp/private"],
    ["BETTER_AUTH_URL", "https://user:private@example.com"],
    ["BETTER_AUTH_SECRET", "private"],
    ["GOOGLE_CLIENT_ID", "private-client"],
    ["GOOGLE_CLIENT_SECRET", "private-secret"],
  ])("rejects invalid %s without revealing its value", (key, value) => {
    const check = () => readEnvironment({ [key]: value });
    expect(check).toThrow(key.startsWith("GOOGLE_") ? /both Google OAuth credentials/ : key);
    expect(check).not.toThrow(value);
  });
});
