import { cleanup } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import en from "../locales/en/translation.json";

// Components call useTranslation() without an explicit <I18nextProvider> wrapper — it
// falls back to this default global instance as long as init() has run before render.
// Using the real English bundle (not a stub) means existing getByText/getByRole(name:)
// assertions on literal English copy keep passing unmodified after string extraction.
i18next.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// @testing-library/react's automatic post-test cleanup relies on detecting a global
// afterEach (Jest-style globals) — this project runs Vitest with `globals: false` for
// explicit imports everywhere else, so it needs registering here instead.
afterEach(() => {
  cleanup();
});
