import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
    // @mui/material's Dialog/Transition imports react-transition-group via a legacy
    // "fake subdirectory" package.json (main/module fields, no exports map) - Vite's
    // resolver understands that pattern, but Node's native ESM loader (what Vitest uses
    // for modules it treats as "external") doesn't. Since the failing import happens
    // *inside* an un-inlined @mui/material file, inlining react-transition-group alone
    // isn't enough — @mui itself needs to go through Vite's resolver too.
    server: {
      deps: {
        // Same issue as the @mui/react-transition-group case above: @material/material-
        // color-utilities' dynamiccolor/*.js files import sibling modules by extensionless
        // relative path, which Vite's resolver accepts but Node's native ESM loader (used
        // for modules Vitest treats as external) rejects.
        inline: [/@mui\//, "react-transition-group", /@material\//],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "test/**"],
    },
  },
});
