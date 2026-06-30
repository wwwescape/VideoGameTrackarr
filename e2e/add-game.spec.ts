import { expect, test } from "@playwright/test";

test("adding a game manually navigates to its detail page and shows up in the library", async ({ page }) => {
  const gameName = `E2E Test Game ${Date.now()}`;

  await page.goto("/games/add");
  await page.getByRole("radio", { name: "Manually" }).click();

  await page.getByLabel("Name").fill(gameName);
  await page.getByRole("button", { name: "Add game" }).click();

  await page.waitForURL(/\/game\/\d+/);
  await expect(page.getByRole("heading", { name: gameName, exact: false })).toBeVisible();

  await page.goto("/");
  await page.getByLabel("Search games").fill(gameName);
  await expect(page.locator(".MuiCard-root strong", { hasText: gameName })).toBeVisible();
});
