import { expect, test } from "@playwright/test";

test("logging progress for an owned platform persists across a reload", async ({ page }) => {
  // A fresh manually-added game, isolated from whatever's already in the scratch copy's
  // library — Progress can only be logged for a platform the game is owned on, and this
  // guarantees a clean starting point (no platforms owned, no progress logged) rather than
  // depending on the state of an arbitrary existing game.
  const gameName = `E2E Progress Test ${Date.now()}`;

  await page.goto("/games/add");
  await page.getByRole("radio", { name: "Manually" }).click();
  await page.getByLabel("Name").fill(gameName);
  await page.getByRole("button", { name: "Add game" }).click();
  // A random test title is never a real IGDB match — the app double-checks before adding a
  // manual entry that might be a duplicate, so confirm through that safety dialog if it
  // shows up (it's async, so give it a moment rather than checking immediately).
  const continueManually = page.getByRole("button", { name: "Continue to add game manually" });
  await continueManually.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await continueManually.isVisible()) {
    await continueManually.click();
  }
  // Manually-added games route by name-slug+uuid (see utils/identifiers.ts), not a numeric
  // id — unlike an IGDB import, which carries IGDB's own numeric-looking slug.
  await page.waitForURL(/\/game\/[\w-]+/);

  // MUI Autocomplete's input is a combobox whose accessible name comes from its own label
  // span (via aria-labelledby), not a native <label for> — getByRole matches it directly,
  // where getByLabel doesn't.
  await page.getByRole("button", { name: "Add Collection" }).click();
  await page.getByRole("combobox", { name: "Platform" }).click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Game added to your collection successfully!")).toBeVisible();

  await page.getByRole("button", { name: "Add Progress" }).click();
  await page.getByRole("combobox", { name: "Platform" }).click();
  await page.getByRole("option").first().click();
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Playing" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Progress added!")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("cell", { name: "Playing" })).toBeVisible();
});
