import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { checkExistingServer, parseOptions, prepareEnvironment } from "../scripts/setup-lib.mjs";

const roots = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "recipe-setup-"));
  roots.push(root);
  writeFileSync(join(root, ".env.example"), 'DATABASE_URL=""\nBETTER_AUTH_URL="http://localhost:3000"\nBETTER_AUTH_SECRET=""\n');
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("explicit ports are canonicalized; install-only does not imply a port", () => {
  assert.deepEqual(parseOptions(["--install-only", "--port", "03002"]), { installOnly: true, port: "3002", help: false });
  assert.equal(parseOptions(["--help"]).help, true);
});

test("invalid and shell-like ports/options are rejected before execution", () => {
  for (const port of ["80", "65536", "3000;echo", "", undefined]) {
    assert.throws(() => parseOptions(["--port", port]));
  }
  assert.throws(() => parseOptions(["--unknown"]));
});

test("first setup creates a private env file with a local secret and requested port", () => {
  const root = fixture();
  assert.equal(prepareEnvironment(root, "3002").created, true);
  const local = readFileSync(join(root, ".env.local"), "utf8");
  assert.match(local, /BETTER_AUTH_SECRET="[a-f0-9]{64}"/);
  assert.match(local, /http:\/\/localhost:3002/);
  if (process.platform !== "win32") assert.equal(statSync(join(root, ".env.local")).mode & 0o777, 0o600);
});

test("existing credentials, exported keys, and secrets survive repeated setup byte-for-byte", () => {
  const root = fixture();
  const original = 'export DATABASE_URL="postgresql://fixture:private@localhost/demo"\nBETTER_AUTH_SECRET="keep-this-existing-secret"';
  writeFileSync(join(root, ".env.local"), original);
  const result = prepareEnvironment(root);
  assert.deepEqual(result.added, ["BETTER_AUTH_URL"]);
  const first = readFileSync(join(root, ".env.local"), "utf8");
  assert.ok(first.startsWith(original));
  assert.equal((first.match(/DATABASE_URL=/g) ?? []).length, 1);
  assert.deepEqual(prepareEnvironment(root).added, []);
  assert.equal(readFileSync(join(root, ".env.local"), "utf8"), first);
});

test("an existing blank secret is preserved for explicit user configuration", () => {
  const root = fixture();
  writeFileSync(join(root, ".env.local"), 'BETTER_AUTH_SECRET=""\n');
  prepareEnvironment(root);
  assert.match(readFileSync(join(root, ".env.local"), "utf8"), /^BETTER_AUTH_SECRET=""/);
});

function lockFixture(content) {
  const root = fixture();
  mkdirSync(join(root, ".next", "dev"), { recursive: true });
  writeFileSync(join(root, ".next", "dev", "lock"), content);
  return root;
}

test("a live development server blocks reinstall without modifying its lock", () => {
  const content = JSON.stringify({ pid: 123 });
  const root = lockFixture(content);
  assert.throws(() => checkExistingServer(root, () => {}), /already has a running/);
  assert.equal(readFileSync(join(root, ".next", "dev", "lock"), "utf8"), content);
});

test("a dead PID allows setup; unreadable metadata and permission errors fail safely", () => {
  const root = lockFixture(JSON.stringify({ pid: 123 }));
  assert.doesNotThrow(() => checkExistingServer(root, () => { throw Object.assign(new Error(), { code: "ESRCH" }); }));
  assert.throws(() => checkExistingServer(root, () => { throw Object.assign(new Error(), { code: "EPERM" }); }), /Cannot inspect/);
  writeFileSync(join(root, ".next", "dev", "lock"), "invalid");
  assert.throws(() => checkExistingServer(root), /cannot be read/);
});
