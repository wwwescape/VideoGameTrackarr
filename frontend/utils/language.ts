export interface LanguageOption {
  code: string;
  name: string;
}

// Native names — a language picker shows each option in its own language, not translated
// into the currently selected one.
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
];

export const DEFAULT_LANGUAGE = "en";

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((option) => option.code));

const LANGUAGE_STORAGE_KEY = "vgt.language";

function detectBrowserLanguage(): string | null {
  const prefix = navigator.language?.split("-")[0];
  return prefix && SUPPORTED_CODES.has(prefix) ? prefix : null;
}

export function readStoredLanguage(): string {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_CODES.has(stored)) {
    return stored;
  }
  return detectBrowserLanguage() ?? DEFAULT_LANGUAGE;
}

export function persistLanguage(language: string): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}
