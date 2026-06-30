import { expect, test } from "@playwright/test";
import { login } from "./test-helpers";

// These two specifically exercise the login flow itself, so they need a genuinely
// logged-out context — overriding the project-wide storageState (see playwright.config.ts
// and global-setup.ts) back to empty, rather than reusing the pre-authenticated session
// every other file in this suite relies on.
test.describe("login flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("logging in with valid credentials reaches the game list", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Games" })).toBeVisible();
  });

  test("logging in with invalid credentials shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("not-a-real-user");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid username or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test("logging out returns to the login page and blocks access to protected routes", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("logged-in session survives a reload", async ({ page }) => {
  await page.goto("/");

  await page.reload();

  await expect(page.getByRole("heading", { name: "Games" })).toBeVisible();
});
