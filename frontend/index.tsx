import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router-dom";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { offlinePersistOptions } from "./offline/queryPersistence";
import router from "./router";
import { ColorModeProvider } from "./theme/ColorModeProvider";
import { CurrencyProvider } from "./theme/CurrencyProvider";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

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
          <RouterProvider router={router} />
        </CurrencyProvider>
      </ColorModeProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
