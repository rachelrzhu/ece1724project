import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = new URL(process.env.SMOKE_ORIGIN || "http://127.0.0.1:3100");
const { origin } = baseURL;
const local = ["localhost", "127.0.0.1", "[::1]"].includes(baseURL.hostname);
assert(baseURL.href === origin + "/", "Set SMOKE_ORIGIN to the application origin.");
if (!local) {
  assert.equal(baseURL.protocol, "https:");
  assert.equal(baseURL.hostname, "ece1724project-git-preprod-rachelrzhus-projects.vercel.app", "Use the project preprod alias.");
}
const ownerEmail = process.env.SMOKE_OWNER_EMAIL || (local && "rachel@savor.local");
const readerEmail = process.env.SMOKE_READER_EMAIL || (local && "grace@savor.local");
const localPassword = local && "SavorKitchen2026!";
const ownerPassword = process.env.SMOKE_OWNER_PASSWORD || localPassword;
const readerPassword = process.env.SMOKE_READER_PASSWORD || localPassword;
assert(ownerEmail && readerEmail && ownerPassword && readerPassword, "Supply both smoke-test accounts.");
assert.notEqual(ownerEmail, readerEmail, "Supply distinct accounts.");

const headerName = process.env.SMOKE_PREVIEW_HEADER_NAME;
const headerValue = process.env.SMOKE_PREVIEW_HEADER_VALUE;
const previewHeaders = {};
if (headerName || headerValue) {
  assert(!local && headerValue && ["x-vercel-protection-bypass", "x-vercel-trusted-oidc-idp-token"].includes(headerName), "Invalid preview-protection configuration.");
  previewHeaders[headerName] = headerValue;
}
const runId = randomUUID();
const title = "Smoketest " + runId;
const ingredient = "Cocoa " + runId;
const copyTitle = "Personal recipe " + runId;
const fixture = await readFile(new URL("../tests/fixtures/storage-sample.png", import.meta.url));
const browser = await chromium.launch();
const [ownerContext, readerContext, guestContext] = await Promise.all(
  Array.from({ length: 3 }, () => createContext()),
);
const [owner, reader, guest] = await Promise.all(
  [ownerContext, readerContext, guestContext].map((context) => context.newPage()),
);
let detail;
let cover;
let deleted = false;
let copyDetail;
let copyDeleted = false;
let passedChecks = 0;

async function createContext() {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) return route.abort();
    if (!headerName) return route.continue();
    // Per-request headers must never follow a redirect to another origin.
    let response;
    try {
      response = await route.fetch({
        headers: { ...await request.allHeaders(), ...previewHeaders },
        maxRedirects: 0,
      });
      const location = response.headers().location;
      if (location && new URL(location, request.url()).origin !== origin) {
        return await route.abort();
      }
      return await route.fulfill({ response });
    } catch {
      // Playwright network failures can contain the authentication headers.
      await route.abort();
    } finally {
      await response?.dispose();
    }
  });
  return context;
}

function get(context, path) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin);
  return context.request.get(url.href, { headers: previewHeaders, maxRedirects: 0 });
}

function passed(name) {
  passedChecks++;
  console.log("PASS", name);
}

function reportFailure(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const sensitive of [ownerPassword, readerPassword, headerValue]) {
    if (sensitive) message = message.replaceAll(sensitive, "[redacted]");
  }
  console.error(message.replace(/(cookie|authorization):[^\n]*/gi, "$1: [redacted]"));
  process.exitCode = 1;
}

async function signIn(page, email, password) {
  await page.goto("/account");
  assert.equal(new URL(page.url()).origin, origin);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.reload();
  await page.getByText("Signed in as " + email, { exact: true }).waitFor();
}

async function signOut(page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.reload();
  await page.getByRole("link", { name: "Sign in or register" }).waitFor();
  const response = await get(page.context(), "/api/auth/get-session");
  assert.equal(response.status(), 200);
  assert.equal(await response.json(), null);
}

async function search(page, term, count, collection = "explore") {
  await page.goto("/?collection=" + collection);
  await page.getByRole("searchbox").fill(term);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === term && url.searchParams.get("collection") === collection);
  await page.reload();
  if (count === 0) {
    await page.getByText("No recipes found.", { exact: true }).waitFor();
  } else {
    await page.getByRole("link", { name: title, exact: true }).waitFor();
  }
  assert.equal(await page.getByRole("link", { name: title, exact: true }).count(), count);
}

async function expectDetail(page, visible, url = detail, expectedTitle = title) {
  const response = await page.goto(url);
  if (visible) {
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: expectedTitle, exact: true }).waitFor();
  } else {
    // A streamed App Router response can render the 404 boundary after sending 200.
    assert([404, 200].includes(response.status()));
    await page.getByRole("heading", { name: "404", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: expectedTitle, exact: true }).count(), 0);
  }
}

async function expectImage(context, visible) {
  const response = await get(context, cover);
  assert.equal(response.status(), visible ? 200 : 404);
  assert.match(response.headers()["cache-control"], /no-store/);
  const bytes = await response.body();
  if (visible) {
    assert.match(response.headers()["content-type"], /image\/png/);
    assert.deepEqual(bytes, fixture);
  } else {
    assert.equal(bytes.length, 0);
  }
}

async function saveVisibility(visibility, instruction) {
  await owner.goto(detail + "?edit=1");
  if (instruction) await owner.getByLabel("Step 1", { exact: true }).fill(instruction);
  const choice = owner.getByRole("radiogroup", { name: "Visibility", exact: true });
  await choice.getByText(visibility, { exact: true }).click();
  assert(await choice.getByRole("radio", { name: visibility, exact: true }).isChecked());
  await owner.getByRole("button", { name: "Save recipe", exact: true }).click();
  await owner.waitForURL((url) => url.pathname === detail && !url.search);
  await owner.getByText(new RegExp(" · " + visibility.toLowerCase() + "$")).waitFor();
}

async function deleteFixture(page, path) {
  await page.goto(path);
  const fixtureTitle = await page.getByRole("heading", { level: 1 }).innerText();
  assert([title, copyTitle].includes(fixtureTitle), "Unexpected fixture title.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete recipe: " + fixtureTitle, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("collection") === "mine");
}

async function clearOwnedFixtures(page) {
  // Navigation can fail after creation committed but before we received the new ID.
  await page.goto("/?collection=mine&q=" + runId);
  for (const fixtureTitle of [title, copyTitle]) {
    const paths = await page.getByRole("link", { name: fixtureTitle, exact: true })
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const path of paths) {
      assert.match(path, /^\/recipes\/[\da-f-]{36}$/);
      await deleteFixture(page, path);
    }
  }
}

try {
  await Promise.all([signIn(owner, ownerEmail, ownerPassword), signIn(reader, readerEmail, readerPassword)]);
  passed("Two independent email/password sessions survive refresh");

  await owner.goto("/recipes/new");
  await owner.getByLabel("Title", { exact: true }).fill(title);
  await owner.getByLabel("Description", { exact: true }).fill("Disposable browser verification recipe.");
  await owner.getByLabel("Name", { exact: true }).fill(ingredient);
  await owner.getByLabel("Quantity (optional)", { exact: true }).fill("400");
  await owner.getByLabel("Unit", { exact: true }).fill("g");
  await owner.getByLabel("Step 1", { exact: true }).fill("Stir and serve.");
  await owner.getByLabel(/Cover image/).setInputFiles({ name: "smoke-" + runId + ".png", mimeType: "image/png", buffer: fixture });
  assert(await owner.getByRole("radio", { name: "Private", exact: true }).isChecked());
  await owner.getByRole("button", { name: "Save recipe", exact: true }).click();
  await owner.waitForURL((url) => /^\/recipes\/[\da-f-]{36}$/.test(url.pathname));
  detail = new URL(owner.url()).pathname;
  cover = await owner.getByRole("link", { name: "View cover photo" }).getAttribute("href");
  assert.match(cover, /^\/api\/images\/[\da-f-]{36}$/);
  console.log("Fixture", JSON.stringify({ title, detail, cover }));
  await Promise.all([expectDetail(owner, true), expectDetail(reader, false), expectDetail(guest, false)]);
  await Promise.all([expectImage(ownerContext, true), expectImage(readerContext, false), expectImage(guestContext, false)]);
  await Promise.all([search(owner, title, 1, "mine"), search(reader, title, 0), search(guest, ingredient, 0)]);
  passed("New private recipe and cover are accessible only to the owner");

  await saveVisibility("Public");
  await Promise.all([search(reader, title, 1), search(guest, ingredient.toUpperCase(), 1)]);
  await Promise.all([expectDetail(reader, true), expectDetail(guest, true)]);
  await Promise.all([expectImage(readerContext, true), expectImage(guestContext, true)]);
  assert.equal(await reader.getByRole("link", { name: "Edit recipe", exact: true }).count(), 0);
  const stale = await readerContext.newPage();
  await expectDetail(stale, false, detail + "?edit=1");
  await expectDetail(stale, true);
  passed("Public title and case-insensitive ingredient search, detail and cover; reader cannot edit");

  // Both pages still hold the unsaved state and send the same save instruction.
  await Promise.all([reader, stale].map((page) => page.getByRole("button", { name: "Bookmark recipe", exact: true }).click()));
  await Promise.all([reader, stale].map((page) => page.getByRole("button", { name: "Remove bookmark", exact: true }).waitFor()));
  await stale.close();
  await search(reader, title, 1, "saved");
  passed("Two independent save submissions both succeed and produce one saved listing");

  await reader.goto(detail);
  await reader.getByRole("button", { name: "Make an editable copy" }).click();
  await reader.waitForURL((url) => /^\/recipes\/[\da-f-]{36}$/.test(url.pathname)
    && url.pathname !== detail && url.searchParams.get("edit") === "1");
  copyDetail = new URL(reader.url()).pathname;
  assert.equal(await reader.getByLabel("Title", { exact: true }).inputValue(), title);
  assert.equal(await reader.getByLabel("Name", { exact: true }).inputValue(), ingredient);
  assert.equal(await reader.getByLabel("Quantity (optional)").inputValue(), "400");
  assert.equal(await reader.getByLabel("Step 1", { exact: true }).inputValue(), "Stir and serve.");
  assert(await reader.getByRole("radio", { name: "Private", exact: true }).isChecked());
  assert.equal(await reader.getByRole("link", { name: "View current cover" }).count(), 0);

  await reader.getByLabel("Title", { exact: true }).fill(copyTitle);
  await reader.getByLabel("Quantity (optional)").fill("200");
  await reader.getByLabel("Step 1", { exact: true }).fill("Chill the copy.");
  await reader.getByRole("button", { name: "Save recipe", exact: true }).click();
  await reader.waitForURL((url) => url.pathname === copyDetail && !url.search);
  await expectDetail(reader, true, copyDetail, copyTitle);
  assert.equal(await reader.getByRole("link", { name: "View cover photo" }).count(), 0);
  await expectDetail(owner, false, copyDetail, copyTitle);
  await expectDetail(guest, false, copyDetail, copyTitle);
  await expectDetail(owner, true);
  await owner.getByText("400 g " + ingredient, { exact: true }).waitFor();
  await owner.getByText("Stir and serve.", { exact: true }).waitFor();
  passed("Reader independently edits a new private copy with its own ingredients, steps and no source photo");

  await saveVisibility("Private", "Whisk the original.");
  await Promise.all([search(reader, ingredient, 0, "saved"), search(guest, title, 0), search(owner, title, 1, "mine")]);
  await search(reader, title, 0);
  await Promise.all([expectDetail(owner, true), expectDetail(reader, false), expectDetail(guest, false)]);
  await Promise.all([expectImage(ownerContext, true), expectImage(readerContext, false), expectImage(guestContext, false)]);
  passed("Unpublishing revokes discovery, saved listing, direct detail and cover; owner retains access");

  await owner.getByText("Whisk the original.", { exact: true }).waitFor();
  await expectDetail(reader, true, copyDetail, copyTitle);
  await reader.getByText("Chill the copy.", { exact: true }).waitFor();
  await deleteFixture(owner, detail);
  deleted = true;
  await expectDetail(owner, false);
  await search(owner, title, 0, "mine");
  passed("Owner deletes the fixture and loses access to its recipe detail");
  await expectDetail(reader, true, copyDetail, copyTitle);
  await reader.getByText("200 g " + ingredient, { exact: true }).waitFor();
  await reader.getByText("Chill the copy.", { exact: true }).waitFor();
  await deleteFixture(reader, copyDetail);
  copyDeleted = true;
  passed("Source edits, privacy changes and deletion preserve the independent copy");
  await Promise.all([signOut(owner), signOut(reader)]);
  passed("Both sessions are invalidated after logout");
} catch (error) {
  reportFailure(error);
} finally {
  try {
    const cleanup = [];
    if (!deleted) cleanup.push(clearOwnedFixtures(owner));
    if (!copyDeleted) cleanup.push(clearOwnedFixtures(reader));
    for (const result of await Promise.allSettled(cleanup)) {
      if (result.status === "rejected") reportFailure(result.reason);
    }
  } catch (error) {
    reportFailure(error);
  } finally {
    console.log("Fixture teardown", JSON.stringify({ detail, deleted, copyDetail, copyDeleted, retainedCover: cover, passed: passedChecks }));
    await browser.close();
  }
}
