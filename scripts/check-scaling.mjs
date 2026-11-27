import assert from "node:assert/strict";

// Both the smoke fixture and the seeded pasta recipe include a 400 g ingredient.
export async function checkDisplayUnits(page) {
  const quantities = page.getByRole("list", { name: "Ingredient quantities" });
  const region = page.getByRole("region", { name: "Ingredients" });
  const servings = page.getByLabel("Target servings", { exact: true });
  const baseServings = Number(await servings.inputValue());
  const original = region.getByRole("radio", { name: "Original", exact: true });
  const metric = region.getByRole("radio", { name: "Metric", exact: true });
  const imperial = region.getByRole("radio", { name: "Imperial", exact: true });

  assert(await original.isChecked());
  await quantities.getByText("400 g", { exact: true }).waitFor();
  await imperial.check();
  await quantities.getByText("14.1 oz", { exact: true }).waitFor();
  await page.getByRole("main").getByRole("link", { name: "Explore recipes", exact: true }).click();
  await page.getByRole("searchbox").waitFor();
  await page.goBack();
  await quantities.getByText("14.1 oz", { exact: true }).waitFor();
  assert(await imperial.isChecked());
  assert(await region.getByRole("button", { name: "Undo", exact: true }).isDisabled());
  await servings.fill("1.33333");
  await region.getByRole("alert").waitFor();
  await quantities.getByText("14.1 oz", { exact: true }).waitFor();
  await servings.fill(String(baseServings * 1.3));
  await quantities.getByText("1.15 lb", { exact: true }).waitFor();
  await metric.check();
  await quantities.getByText("520 g", { exact: true }).waitFor();
  await region.getByRole("button", { name: "Reset", exact: true }).click();
  await original.check();
  await quantities.getByText("400 g", { exact: true }).waitFor();
}

export async function checkScaling(page, ingredient) {
  await checkDisplayUnits(page);
  const quantities = page.getByRole("list", { name: "Ingredient quantities" });
  const region = page.getByRole("region", { name: "Ingredients" });
  const status = region.getByRole("status");
  const servings = page.getByLabel("Target servings", { exact: true });
  const amount = page.getByLabel("Available quantity", { exact: true });
  const unit = page.getByLabel("Unit", { exact: true });
  const reset = page.getByRole("button", { name: "Reset", exact: true });
  const undo = page.getByRole("button", { name: "Undo", exact: true });

  await servings.fill("1.3");
  await quantities.getByText("520 g", { exact: true }).waitFor();
  await status.getByText("Serves 1.3", { exact: true }).waitFor();
  await status.getByText("×1.3 batch", { exact: true }).waitFor();

  await page.getByRole("button", { name: "By ingredient", exact: true }).click();
  const options = page.getByLabel("Ingredient on hand", { exact: true }).getByRole("option");
  assert.deepEqual(await options.allTextContents(), [ingredient]);
  await amount.fill("177.777");
  await region.getByRole("alert").waitFor();
  await amount.fill("200");
  await quantities.getByText("200 g", { exact: true }).waitFor();
  await unit.selectOption("kg");
  await quantities.getByText("200 g", { exact: true }).waitFor();
  assert.equal(await amount.inputValue(), "0.2");
  await status.getByText("Serves 0.5", { exact: true }).waitFor();

  await amount.fill("0");
  await region.getByRole("alert").waitFor();
  await quantities.getByText("400 g", { exact: true }).waitFor();
  await undo.click();
  await quantities.getByText("200 g", { exact: true }).waitFor();
  await region.getByRole("radio", { name: "Imperial", exact: true }).check();
  await quantities.getByText("7.05 oz", { exact: true }).waitFor();
  await reset.click();
  await quantities.getByText("14.1 oz", { exact: true }).waitFor();
  assert.equal(await servings.inputValue(), "1");
  await undo.click();
  await quantities.getByText("7.05 oz", { exact: true }).waitFor();
  await region.getByRole("radio", { name: "Original", exact: true }).check();
  await quantities.getByText("200 g", { exact: true }).waitFor();
  assert.equal(await unit.inputValue(), "kg");
}
