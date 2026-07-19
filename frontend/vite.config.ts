import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
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
