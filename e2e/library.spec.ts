import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("the library shows at least one game card", async ({ page }) => {
  const firstCard = page.locator(".MuiCard-root").first();

  await expect(firstCard).toBeVisible();
});

test("searching narrows the list to matching games", async ({ page }) => {
  const firstCardName = await page.locator(".MuiCard-root strong").first().textContent();
  test.skip(!firstCardName, "Library is empty on this scratch copy — nothing to search for.");

  const searchTerm = firstCardName!.slice(0, Math.max(4, Math.ceil(firstCardName!.length / 2)));
  await page.getByLabel("Search games").fill(searchTerm);

  await expect(page.locator(".MuiCard-root strong", { hasText: firstCardName! }).first()).toBeVisible();
});

test("clicking a game card opens its detail page", async ({ page }) => {
  const firstCard = page.locator(".MuiCard-root").first();
  const gameName = await firstCard.locator("strong").textContent();

  await firstCard.click();

  await expect(page).toHaveURL(/\/(game|addon)\/\d+/);
  if (gameName) {
    await expect(page.getByRole("heading", { name: gameName, exact: false }).first()).toBeVisible();
  }
});

test("the Owned filter chip only shows owned games", async ({ page }) => {
  await page.getByText("Owned", { exact: true }).click();

  // Owned games show a green checkmark badge (see GameCard.tsx, aria-label "In your
  // collection") - every visible card should have one once this filter is active, so the
  // two counts should converge to equal once the filtered re-render settles (.count()
  // alone doesn't wait/retry, so reading both once right after the click risks comparing
  // two different render passes). Targeting the icon by its aria-label rather than MUI's
  // data-testid, since MUI strips data-testid in production builds (NODE_ENV=production) -
  // present in a Vitest/jsdom run, absent from what this suite actually exercises.
  await expect
    .poll(async () => {
      const cardCount = await page.locator(".MuiCard-root").count();
      const badgeCount = await page.locator('svg[aria-label="In your collection"]').count();
      return cardCount === badgeCount;
    })
    .toBe(true);
});
