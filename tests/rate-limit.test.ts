import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { takeLimit } from "@/lib/security/rate-limit";

const query = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => ({ $queryRaw: query }) }));

const db = new PGlite();
beforeAll(async () => {
  await db.exec("CREATE TABLE users (id integer PRIMARY KEY)");
  await db.exec(readFileSync("prisma/migrations/20261125020000_write_rate_limits/migration.sql", "utf8"));
});
beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-rate-limit-secret-at-least-32-characters");
  query.mockReset().mockImplementation(async (sql: Prisma.Sql) => (await db.query(sql.text, sql.values)).rows);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(() => db.close());

it("accepts only the allowed count and suppresses repeat database checks for a blocked caller", async () => {
  const decisions = await Promise.all(Array.from({ length: 7 }, () => takeLimit("signup", "test-network-a")));
  expect(decisions.filter(Boolean)).toHaveLength(5);
  const count = query.mock.calls.length;
  expect(await takeLimit("signup", "test-network-a")).toBe(false);
  expect(query).toHaveBeenCalledTimes(count);
  expect(await takeLimit("signup", "test-network-b")).toBe(true);
  expect(await takeLimit("signin", "test-network-a")).toBe(true);

  const { rows } = await db.query<{ used: number; slot: number }>(
    "SELECT used, slot FROM write_rate_limits WHERE policy='signup' ORDER BY used",
  );
  expect(rows.map(bucket => bucket.used)).toEqual([1, 5]);
  expect(rows.every(bucket => bucket.slot >= 0 && bucket.slot < 16_384)).toBe(true);
});

it("shares a single global bucket across identities and resets its row after expiry", async () => {
  expect(await takeLimit("uploadGlobal", "test-network-a")).toBe(true);
  await db.exec("UPDATE write_rate_limits SET used = 119 WHERE policy='uploadGlobal'");
  expect(await takeLimit("uploadGlobal", "test-network-b")).toBe(true);
  expect(await takeLimit("uploadGlobal", "test-network-c")).toBe(false);
  await db.exec("UPDATE write_rate_limits SET expires_at = now() - interval '1 second' WHERE policy='uploadGlobal'");
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31_000);
  expect(await takeLimit("uploadGlobal", "test-network-c")).toBe(true);
  expect((await db.query("SELECT slot, used FROM write_rate_limits WHERE policy='uploadGlobal'")).rows)
    .toEqual([{ slot: 0, used: 1 }]);
});

it("denies a write when it cannot establish the caller's allowance", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  query.mockRejectedValueOnce(new Error("connection unavailable"));
  expect(await takeLimit("upload", "test-cook")).toBe(false);
  expect(log).toHaveBeenCalledWith("The database write rate limiter is unavailable.");
  vi.stubEnv("BETTER_AUTH_SECRET", "");
  expect(await takeLimit("upload", "test-cook")).toBe(false);
  expect(query).toHaveBeenCalledOnce();
});

it("reserves registration capacity in the account transaction, across providers", async () => {
  await db.exec("BEGIN; INSERT INTO users VALUES (1); ROLLBACK");
  expect((await db.query("SELECT used FROM write_rate_limits WHERE policy='accounts'")).rows).toEqual([]);
  await db.exec("INSERT INTO users VALUES (2); UPDATE write_rate_limits SET used=79 WHERE policy='accounts'");
  await db.exec("INSERT INTO users VALUES (3)");
  await expect(db.exec("INSERT INTO users VALUES (4)")).rejects.toThrow(/registration capacity/);
  expect((await db.query("SELECT id FROM users ORDER BY id")).rows).toEqual([{ id: 2 }, { id: 3 }]);
  await db.exec("UPDATE write_rate_limits SET expires_at=now() WHERE policy='accounts'; INSERT INTO users VALUES (4)");
  expect((await db.query("SELECT used FROM write_rate_limits WHERE policy='accounts'")).rows).toEqual([{ used: 1 }]);
});
