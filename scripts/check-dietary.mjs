import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

const mappedIngredient = "milk chocolate with peanuts";

async function readPreferences(page) {
  await page.goto("/account");
  const pattern = page.getByLabel("Dietary pattern", { exact: true });
  await pattern.waitFor();
  const group = page.getByRole("group", { name: "Allergens to flag", exact: true });
  const allergens = await group.locator('input[type="checkbox"]:checked')
    .evaluateAll((inputs) => inputs.map((input) => input.value).sort());
  return { pattern: await pattern.inputValue(), allergens };
}

async function savePreferences(page, preferences) {
  await page.goto("/account");
  const select = page.getByLabel("Dietary pattern", { exact: true });
  await select.selectOption(preferences.pattern);
  const group = page.getByRole("group", { name: "Allergens to flag", exact: true });
  const choices = await group.getByRole("checkbox").all();
  for (const choice of choices) {
    const value = await choice.getAttribute("value");
    await choice.setChecked(preferences.allergens.includes(value));
  }
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await page.getByText("Dietary preferences saved.", { exact: true }).waitFor();
  assert(isDeepStrictEqual(await readPreferences(page), preferences), "Saved preferences did not survive a fresh account request.");
}

async function clearPreferences(page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Clear preferences", exact: true }).click();
  await page.getByText("Dietary preferences cleared.", { exact: true }).waitFor();
  assert(isDeepStrictEqual(await readPreferences(page), { pattern: "NONE", allergens: [] }), "Clearing the dietary profile did not persist.");
}

async function editIngredient(owner, detail, name) {
  await owner.goto(detail + "?edit=1");
  await owner.getByLabel("Name", { exact: true }).fill(name);
  await owner.getByRole("button", { name: "Save recipe", exact: true }).click();
  await owner.waitForURL((url) => url.pathname === detail && !url.search);
  await owner.getByRole("listitem").filter({ hasText: name }).first().waitFor();
}

async function openMoreFilters(page) {
  const filters = page.locator("details").filter({ has: page.locator("summary", { hasText: "More filters" }) });
  if (await filters.getAttribute("open") === null) await filters.locator("summary").click();
}

export async function checkDietaryPreferences({ owner, reader, guest, title, detail, ingredient, passed }) {
  const [original, otherProfile] = await Promise.all([readPreferences(reader), readPreferences(owner)]);
  const results = "/recipes?" + new URLSearchParams({ q: title, maxMinutes: "30" });
  const filtered = results + "&dietary=1";
  const link = reader.getByRole("link", { name: title, exact: true });
  const noMatch = (page) => page.getByText(`No recipes match “${title}”.`, { exact: true }).filter({ visible: true });
  const applyFilters = (page) => page.getByRole("button", { name: "Apply filters", exact: true }).click();

  try {
    await savePreferences(reader, { pattern: "VEGAN", allergens: ["MILK", "PEANUT"] });
    assert(isDeepStrictEqual(await readPreferences(owner), otherProfile), "Editing preferences changed the other account.");
    await guest.goto("/account");
    assert.equal(await guest.getByLabel("Dietary pattern", { exact: true }).count(), 0);
    passed("Dietary pattern and declared allergens persist after refresh and stay scoped to the signed-in cook");

    await reader.goto(detail);
    const flags = reader.getByRole("region", { name: "Your dietary flags", exact: true });
    await flags.getByRole("heading", { name: "Incomplete ingredient information", exact: true }).waitFor();
    await flags.getByText(ingredient, { exact: true }).waitFor();
    await reader.getByText("No known conflicts in mapped ingredients.", { exact: true }).waitFor();
    await reader.goto(results);
    await openMoreFilters(reader);
    await reader.getByRole("checkbox", { name: "Hide known conflicts", exact: true }).check();
    await applyFilters(reader);
    await reader.waitForURL((url) => url.searchParams.get("q") === title && url.searchParams.get("dietary") === "1"
      && url.searchParams.get("maxMinutes") === "30");
    await reader.reload();
    await link.waitFor();
    await reader.getByText("1 ingredient with incomplete information", { exact: true }).waitFor();
    await reader.getByRole("link", { name: "Remove dietary filter", exact: true }).click();
    await reader.waitForURL((url) => !url.searchParams.has("dietary") && url.searchParams.get("maxMinutes") === "30");
    passed("An unmapped ingredient stays visible and marked incomplete when time and dietary filters are combined");

    await editIngredient(owner, detail, mappedIngredient);
    await reader.goto(results);
    await link.waitFor();
    await reader.goto(detail);
    await flags.getByRole("heading", { name: "Known conflicts", exact: true }).waitFor();
    await flags.getByText("Milk chocolate with peanuts", { exact: true }).waitFor();
    await flags.getByText("Contains milk", { exact: true }).waitFor();
    await flags.getByText("Contains peanuts", { exact: true }).waitFor();
    const ingredients = reader.getByRole("region", { name: "Ingredients", exact: true });
    assert.equal(await ingredients.getByRole("combobox").count(), 0, "Serving mode should have no ingredient language picker.");
    try {
      await reader.getByRole("radio", { name: "Français", exact: true }).check();
      const frenchFlags = reader.getByRole("region", { name: "Vos alertes alimentaires", exact: true });
      const quantities = reader.getByRole("list", { name: "Quantités des ingrédients", exact: true });
      await quantities.getByText("Chocolat au lait aux arachides", { exact: true }).waitFor();
      await frenchFlags.getByText("Contient du lait", { exact: true }).waitFor();
      await reader.getByRole("button", { name: "Afficher l’original", exact: true }).click();
      await quantities.getByText(mappedIngredient, { exact: true }).waitFor();
      await frenchFlags.getByText("Contient des arachides", { exact: true }).waitFor();
    } finally {
      await reader.getByRole("radio", { name: "English", exact: true }).check();
      await flags.waitFor();
    }
    passed("The page language controls ingredient names and preserves allergy flags when showing the original");
    await guest.goto(detail);
    assert.equal(await guest.getByRole("heading", { name: "Your dietary flags", exact: true }).count(), 0);
    await guest.goto(filtered);
    await guest.getByRole("link", { name: title, exact: true }).waitFor();
    await openMoreFilters(guest);
    await guest.getByRole("checkbox", { name: "Milk", exact: true }).check();
    await guest.getByRole("checkbox", { name: "Peanuts", exact: true }).check();
    await applyFilters(guest);
    await noMatch(guest).waitFor();
    assert.deepEqual(new URL(guest.url()).searchParams.getAll("allergen"), ["MILK", "PEANUT"]);
    await guest.reload();
    await guest.getByRole("link", { name: "Remove Milk exclusion", exact: true }).click();
    await guest.waitForURL((url) => url.searchParams.getAll("allergen").join(",") === "PEANUT");
    await noMatch(guest).waitFor();
    await guest.getByRole("link", { name: "Remove Peanuts exclusion", exact: true }).click();
    await guest.getByRole("link", { name: title, exact: true }).waitFor();
    assert.equal(new URL(guest.url()).searchParams.get("maxMinutes"), "30");
    await openMoreFilters(guest);
    await guest.getByLabel("Ingredient name to exclude").fill("CHOCOLATE");
    await applyFilters(guest);
    await noMatch(guest).waitFor();
    await guest.getByRole("link", { name: "Remove ingredient exclusion", exact: true }).click();
    await guest.getByRole("link", { name: title, exact: true }).waitFor();
    passed("A guest can remove individual allergen and ingredient exclusions while keeping the search and time limit");

    await reader.goto(filtered + "&allergen=MILK&allergen=PEANUT&exclude=chocolate&page=2&view=list");
    await noMatch(reader).waitFor();
    await reader.getByRole("button", { name: "Clear filters", exact: true }).click();
    await reader.waitForURL((url) => url.pathname === "/recipes" && url.searchParams.toString() === "view=list");
    await link.waitFor();
    assert.equal(await reader.getByRole("searchbox").inputValue(), "");
    assert.equal(await reader.getByRole("spinbutton", { name: "Ready in", exact: true }).inputValue(), "");
    assert.equal(await reader.getByRole("link", { name: "List", exact: true }).getAttribute("aria-current"), "page");
    assert.equal(await reader.locator('input[name="allergen"]:checked').count(), 0);
    assert.equal(await reader.getByLabel("Ingredient name to exclude").inputValue(), "");
    passed("Clear filters removes the search, time limit and dietary exclusions, resets pagination and keeps list view");

    // Each restriction must exclude the same known ingredient independently.
    for (const profile of [
      { pattern: "NONE", allergens: ["MILK"] },
      { pattern: "NONE", allergens: ["PEANUT"] },
      { pattern: "VEGAN", allergens: [] },
    ]) {
      await savePreferences(reader, profile);
      await reader.goto(filtered);
      await noMatch(reader).waitFor();
      assert.equal(await link.count(), 0);
    }
    await savePreferences(reader, { pattern: "VEGETARIAN", allergens: [] });
    await reader.goto(filtered);
    await link.waitFor();
    await reader.getByText("1 ingredient with incomplete information", { exact: true }).waitFor();
    await clearPreferences(reader);
    assert(isDeepStrictEqual(await readPreferences(owner), otherProfile), "Clearing preferences changed the other account.");
    await editIngredient(owner, detail, ingredient);
    passed("Milk, peanuts and a vegan pattern each hide the conflicting recipe; a vegetarian pattern keeps it");
  } finally {
    // A failed navigation on the test tab must not interrupt restoring a local cook's settings.
    const restore = await reader.context().newPage();
    try {
      if (!isDeepStrictEqual(await readPreferences(restore), original)) {
        if (original.pattern === "NONE" && !original.allergens.length) await clearPreferences(restore);
        else await savePreferences(restore, original);
      }
    } finally {
      await restore.close();
    }
  }
}
