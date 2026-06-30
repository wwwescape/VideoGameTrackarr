import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("dashboard tabs all render without error", async ({ page }) => {
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Games" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hardware" })).toBeVisible();
  await expect(page.getByText("Owned").first()).toBeVisible();

  const gamesTabs = page.getByRole("tablist", { name: "Games dashboard tabs" });
  await gamesTabs.getByRole("tab", { name: "Release Calendar" }).click();
  await expect(gamesTabs.getByRole("tab", { name: "Release Calendar" })).toHaveAttribute("aria-selected", "true");

  const hardwareTabs = page.getByRole("tablist", { name: "Hardware dashboard tabs" });
  await hardwareTabs.getByRole("tab", { name: "Release Calendar" }).click();
  await expect(hardwareTabs.getByRole("tab", { name: "Release Calendar" })).toHaveAttribute("aria-selected", "true");
});

test("selecting two games and comparing them renders a comparison table", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Select games").click();

  const checkboxes = page.locator('span.MuiCheckbox-root[aria-label^="Select "]');
  const availableCount = await checkboxes.count();
  test.skip(availableCount < 2, "Need at least two games in the library to compare.");

  await checkboxes.first().click();
  await checkboxes.first().click(); // the first checkbox flips to "Deselect ..." and drops out - .first() now targets the next one

  await page.getByRole("button", { name: "Compare" }).click();

  await page.waitForURL(/\/compare\?ids=/);
  await expect(page.getByRole("heading", { name: "Compare Games" })).toBeVisible();
  await expect(page.getByText("Release year")).toBeVisible();
});
