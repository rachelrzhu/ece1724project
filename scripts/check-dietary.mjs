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

export async function checkDietaryPreferences({ owner, reader, guest, title, detail, ingredient, passed }) {
  const [original, otherProfile] = await Promise.all([readPreferences(reader), readPreferences(owner)]);
  const results = "/?" + new URLSearchParams({ q: title });
  const filtered = results + "&dietary=1";
  const link = reader.getByRole("link", { name: title, exact: true });
  const noMatch = reader.getByText(`No recipes match “${title}”.`, { exact: true });
  const toggle = (name) => reader.getByRole("link", { name, exact: true });

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
    await toggle("Hide known conflicts").click();
    await reader.waitForURL((url) => url.searchParams.get("q") === title && url.searchParams.get("dietary") === "1");
    await reader.reload();
    await link.waitFor();
    await reader.getByText("1 ingredient with incomplete information", { exact: true }).waitFor();
    await toggle("Show all recipes").waitFor();
    passed("An unmapped ingredient stays visible and marked incomplete when the dietary filter survives refresh");

    await editIngredient(owner, detail, mappedIngredient);
    await reader.goto(results);
    await link.waitFor();
    await reader.goto(detail);
    await flags.getByRole("heading", { name: "Known conflicts", exact: true }).waitFor();
    await flags.getByText(mappedIngredient, { exact: true }).waitFor();
    await flags.getByText("Contains milk", { exact: true }).waitFor();
    await flags.getByText("Contains peanuts", { exact: true }).waitFor();
    await guest.goto(detail);
    assert.equal(await guest.getByRole("heading", { name: "Your dietary flags", exact: true }).count(), 0);
    await guest.goto(filtered);
    await guest.getByRole("link", { name: title, exact: true }).waitFor();

    // Each restriction must exclude the same known ingredient independently.
    for (const profile of [
      { pattern: "NONE", allergens: ["MILK"] },
      { pattern: "NONE", allergens: ["PEANUT"] },
      { pattern: "VEGAN", allergens: [] },
    ]) {
      await savePreferences(reader, profile);
      await reader.goto(filtered);
      await noMatch.waitFor();
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
    // Local accounts can have settings from an earlier run or from manual testing.
    if (!isDeepStrictEqual(await readPreferences(reader), original)) {
      if (original.pattern === "NONE" && !original.allergens.length) await clearPreferences(reader);
      else await savePreferences(reader, original);
    }
  }
}
