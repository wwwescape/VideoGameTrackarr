import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "./i18n";
import IsolatedPlayerPage from "./components/IsolatedPlayerPage";
import { ColorModeProvider } from "./theme/ColorModeProvider";
import { LanguageProvider } from "./theme/LanguageProvider";
import "./index.css";

// Entry point of player-isolated.html (DOS/PSP in their own cross-origin-isolated tab) — a
// separate, much smaller page than the main app: no router, no offline persistence.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("#root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ColorModeProvider>
        <LanguageProvider>
          <IsolatedPlayerPage />
        </LanguageProvider>
      </ColorModeProvider>
    </QueryClientProvider>
  </StrictMode>
);
