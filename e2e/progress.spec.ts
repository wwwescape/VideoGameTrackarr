import { expect, test } from "@playwright/test";

async function setStatus(page: import("@playwright/test").Page, label: string) {
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: label }).click();
  await page.getByRole("button", { name: "Save progress" }).click();
  await expect(page.getByText("Progress saved!")).toBeVisible();
}

test("changing a game's play status persists across a reload", async ({ page }) => {
  await page.goto("/");

  // .count() doesn't wait/retry, so checking it immediately after goto() races the
  // library's initial fetch — wait for either a real card or the empty-state message
  // first, so the skip decision reflects the settled page, not a mid-load snapshot.
  const firstCard = page.locator(".MuiCard-root").first();
  await expect(firstCard.or(page.getByText("Please add some games"))).toBeVisible();
  test.skip((await firstCard.count()) === 0, "Library is empty on this scratch copy.");
  await firstCard.click();
  await page.waitForURL(/\/(game|addon)\/\d+/);

  await expect(page.getByLabel("Status")).toBeVisible();

  try {
    await setStatus(page, "Playing");

    await page.reload();
    // MUI's select TextField renders the chosen label as text in a combobox div, not a
    // real <input> with a value — toHaveValue() doesn't apply here, toHaveText() does.
    await expect(page.getByLabel("Status")).toHaveText("Playing");
  } finally {
    // Leave the scratch copy as found, so repeated runs start from the same state.
    await setStatus(page, "Not started");
  }
});
