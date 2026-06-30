import { chromium, type FullConfig } from "@playwright/test";
import { e2eCredentials } from "./test-helpers";

// Logs in once and saves the session (localStorage tokens — see
// frontend/api/tokenStorage.ts) for every other test to reuse via storageState, instead of
// each test logging in
// independently. Necessary, not just an optimization: the login endpoint is rate-limited
// to 5/minute (a real, intentional anti-brute-force measure — see
// backend/app/api/routes/auth.py), which a suite of independent per-test logins blows
// through immediately. auth.spec.ts opts out of the saved state for its own login-flow
// tests, since those need a genuinely unauthenticated context.
export default async function globalSetup(config: FullConfig): Promise<void> {
  const { username, password } = e2eCredentials();
  const baseURL = config.projects[0]?.use?.baseURL;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseURL}/`);
  await page.context().storageState({ path: "e2e/.auth/state.json" });
  await browser.close();
}
