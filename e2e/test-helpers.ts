import type { Page } from "@playwright/test";

export function e2eCredentials(): { username: string; password: string } {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME and E2E_PASSWORD must be set to a throwaway account on a scratch " +
        "database copy — see e2e/README.md. Refusing to guess a default so this can never " +
        "accidentally run against a real account."
    );
  }
  return { username, password };
}

export async function login(page: Page): Promise<void> {
  const { username, password } = e2eCredentials();
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}
