import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Dev-server twin of backend/app/main.py's isolation_headers_for: the DOS/PSP player tab
// (player-isolated.html) and the player iframe it loads with threads=1 must be cross-origin
// isolated for SharedArrayBuffer. Nothing else gets these headers.
function crossOriginIsolation(): Plugin {
  return {
    name: "vgt-cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (
          url.pathname === "/player-isolated.html" ||
          (url.pathname === "/emulatorjs/player.html" && url.searchParams.get("threads") === "1")
        ) {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crossOriginIsolation(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-master.svg"],
      manifest: {
        name: "VideoGameTrackarr",
        short_name: "VGT",
        description: "Track, organize, and explore your video game collection.",
        theme_color: "#7C4DFF",
        background_color: "#7C4DFF",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The self-hosted EmulatorJS player (public/emulatorjs/, see
        // scripts/vendor-emulatorjs.mjs) is only loaded on demand inside the Play Game
        // iframe — never precache its ~6 MB of scripts/cores, and never answer the iframe's
        // navigation to player.html with the SPA's index.html.
        //
        // Same for the DOS/PSP player tab: its HTML must always come from the server, with
        // the COOP/COEP headers that make it cross-origin isolated.
        globIgnores: ["**/emulatorjs/**", "player-isolated.html"],
        navigateFallbackDenylist: [/^\/emulatorjs\//, /^\/player-isolated\.html/],
        // The API itself is NOT runtime-cached here — TanStack Query's own persisted
        // query cache (see offline/) already covers offline data availability at the
        // app-data layer, which is the more useful place for it (parsed objects ready to
        // render, not raw HTTP responses). Workbox only needs to handle what TanStack
        // Query can't: the app shell, and IGDB's cover-art images.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.igdb\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "igdb-cover-art",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  publicDir: "public",
  build: {
    // Repo-root build/, a sibling of frontend/ and backend/ — backend/app/main.py serves
    // this directory directly (FRONTEND_BUILD_DIR), and the Dockerfile's frontend-builder
    // stage copies from this exact path.
    outDir: "../build",
    emptyOutDir: true,
    rollupOptions: {
      // Two pages: the app itself, and the DOS/PSP player tab (see crossOriginIsolation).
      // Relative to the project root (frontend/), where every build runs.
      input: { main: "index.html", playerIsolated: "player-isolated.html" },
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
