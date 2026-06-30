import { defineConfig, devices } from "@playwright/test";

// A manual pre-release check, not a CI gate — see docs/architecture/02-roadmap.md M11 for
// why (full e2e needs a real backend + a built frontend + a seeded scratch database
// together; running that on every PR is a lot of CI complexity and flake risk for a
// personal project). Run it yourself before cutting a release — see e2e/README.md for the
// one-time setup (scratch DB copy, throwaway admin account, starting both servers).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Every test shares one login (see globalSetup below) because the login endpoint is
  // rate-limited — but that means they all share one *refresh token* too, and the backend
  // rotates (single-use-invalidates) refresh tokens on every refresh. Concurrent workers
  // refreshing from the same token would invalidate it out from under each other. Forcing
  // one worker keeps this suite from being a source of its own flakiness.
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Reuses the one login from global-setup.ts everywhere — see its comment for why this
    // is required, not optional. auth.spec.ts overrides this back to logged-out for its
    // own login-flow tests.
    storageState: "e2e/.auth/state.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
