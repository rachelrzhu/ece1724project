import assert from "node:assert/strict";

export async function checkScaling(page, ingredient) {
  const quantities = page.getByRole("list", { name: "Ingredient quantities" });
  const status = page.getByRole("region", { name: "Ingredients" }).getByRole("status");
  const servings = page.getByLabel("Target servings", { exact: true });
  const amount = page.getByLabel("Available quantity", { exact: true });
  const unit = page.getByLabel("Unit", { exact: true });
  const reset = page.getByRole("button", { name: "Reset", exact: true });
  const undo = page.getByRole("button", { name: "Undo", exact: true });

  await servings.fill("1.33333");
  await quantities.getByText("533.3 g", { exact: true }).waitFor();
  await status.getByText("Serves 1.3", { exact: true }).waitFor();
  await status.getByText("×1.3 batch", { exact: true }).waitFor();

  await page.getByRole("button", { name: "By ingredient", exact: true }).click();
  const options = page.getByLabel("Ingredient on hand", { exact: true }).getByRole("option");
  assert.deepEqual(await options.allTextContents(), [ingredient]);
  await amount.fill("177.777");
  await quantities.getByText("177.8 g", { exact: true }).waitFor();
  await unit.selectOption("kg");
  await quantities.getByText("177.8 g", { exact: true }).waitFor();
  await status.getByText("Serves 0.4", { exact: true }).waitFor();

  await amount.fill("0");
  await page.getByRole("alert").filter({ hasText: "Enter a positive available quantity." }).waitFor();
  await quantities.getByText("400 g", { exact: true }).waitFor();
  await undo.click();
  await quantities.getByText("177.8 g", { exact: true }).waitFor();
  await reset.click();
  await quantities.getByText("400 g", { exact: true }).waitFor();
  assert.equal(await servings.inputValue(), "1");
  await undo.click();
  await quantities.getByText("177.8 g", { exact: true }).waitFor();
  assert.equal(await unit.inputValue(), "kg");
}
