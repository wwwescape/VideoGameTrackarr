import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// @testing-library/react's automatic post-test cleanup relies on detecting a global
// afterEach (Jest-style globals) — this project runs Vitest with `globals: false` for
// explicit imports everywhere else, so it needs registering here instead.
afterEach(() => {
  cleanup();
});
