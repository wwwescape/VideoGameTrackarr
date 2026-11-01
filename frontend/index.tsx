import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./i18n";
import { offlinePersistOptions } from "./offline/queryPersistence";
import { createQueryClient } from "./queryClient";
import router from "./router";
import { ColorModeProvider } from "./theme/ColorModeProvider";
import { CurrencyProvider } from "./theme/CurrencyProvider";
import { LanguageProvider } from "./theme/LanguageProvider";
import { StoreRegionProvider } from "./theme/StoreRegionProvider";
import "./index.css";

const queryClient = createQueryClient();

// onlineManager defaults to "online" and only updates on an online/offline *event*, never
// checking navigator.onLine at startup — so reopening the app while already offline would
// otherwise show nothing as offline until the next actual connectivity transition.
onlineManager.setOnline(navigator.onLine);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("#root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={offlinePersistOptions}
      onSuccess={() => queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())}
    >
      <ColorModeProvider>
        <CurrencyProvider>
          <LanguageProvider>
            <StoreRegionProvider>
              <RouterProvider router={router} />
            </StoreRegionProvider>
          </LanguageProvider>
        </CurrencyProvider>
      </ColorModeProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
