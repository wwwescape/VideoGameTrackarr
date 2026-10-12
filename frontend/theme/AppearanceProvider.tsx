import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SEED_COLOR_HEX } from "./m3Colors";

export const DEFAULT_APP_TITLE = "VideoGameTrackarr";

interface AppearanceContextValue {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  appTitle: string;
  setAppTitle: (title: string) => void;
  resetAppearance: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  accentColor: SEED_COLOR_HEX,
  setAccentColor: () => {},
  appTitle: DEFAULT_APP_TITLE,
  setAppTitle: () => {},
  resetAppearance: () => {},
});

export const useAppearance = () => useContext(AppearanceContext);

const ACCENT_STORAGE_KEY = "vgt.accentColor";
const TITLE_STORAGE_KEY = "vgt.appTitle";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function readStoredAccent(): string {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
  return stored && HEX_PATTERN.test(stored) ? stored : SEED_COLOR_HEX;
}

function readStoredTitle(): string {
  const stored = localStorage.getItem(TITLE_STORAGE_KEY);
  return stored && stored.trim() ? stored : DEFAULT_APP_TITLE;
}

export const AppearanceProvider = ({ children }: { children: ReactNode }) => {
  const [accentColor, setAccentColorState] = useState<string>(readStoredAccent);
  const [appTitle, setAppTitleState] = useState<string>(readStoredTitle);

  const setAccentColor = (hex: string) => {
    if (!HEX_PATTERN.test(hex)) return;
    setAccentColorState(hex);
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  };

  const setAppTitle = (title: string) => {
    const trimmed = title.trim();
    const next = trimmed ? trimmed : DEFAULT_APP_TITLE;
    setAppTitleState(next);
    if (trimmed) {
      localStorage.setItem(TITLE_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(TITLE_STORAGE_KEY);
    }
  };

  const resetAppearance = () => {
    setAccentColorState(SEED_COLOR_HEX);
    setAppTitleState(DEFAULT_APP_TITLE);
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    localStorage.removeItem(TITLE_STORAGE_KEY);
  };

  useEffect(() => {
    document.title = appTitle;
  }, [appTitle]);

  return (
    <AppearanceContext.Provider
      value={{ accentColor, setAccentColor, appTitle, setAppTitle, resetAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};
