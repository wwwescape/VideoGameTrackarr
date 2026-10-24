import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { DEFAULT_ACCENT_HEX, type ColorMode, type ContrastLevel } from "./colors";
import { createVgtTheme } from "./createVgtTheme";

interface ColorModeContextValue {
  mode: ColorMode;
  contrast: ContrastLevel;
  // Settings → Display → Accent color, used as-is for primary actions and highlights.
  accentColor: string;
  toggleColorMode: () => void;
  toggleContrast: () => void;
  setAccentColor: (hex: string) => void;
  resetAccentColor: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "light",
  contrast: "normal",
  accentColor: DEFAULT_ACCENT_HEX,
  toggleColorMode: () => {},
  toggleContrast: () => {},
  setAccentColor: () => {},
  resetAccentColor: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

const MODE_STORAGE_KEY = "vgt.colorMode";
const CONTRAST_STORAGE_KEY = "vgt.contrast";
const ACCENT_STORAGE_KEY = "vgt.accentColor";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function readStoredMode(): ColorMode | null {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function readStoredContrast(): ContrastLevel | null {
  const stored = localStorage.getItem(CONTRAST_STORAGE_KEY);
  return stored === "normal" || stored === "high" ? stored : null;
}

// Anything that isn't a plain #RRGGBB (hand-edited storage, an older format) falls back to
// the default rather than breaking the theme.
function readStoredAccent(): string {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
  return stored && HEX_COLOR.test(stored) ? stored.toLowerCase() : DEFAULT_ACCENT_HEX.toLowerCase();
}

const isDefaultAccent = (hex: string) => hex.toLowerCase() === DEFAULT_ACCENT_HEX.toLowerCase();

interface ColorModeProviderProps {
  children: ReactNode;
  // Off for the full-screen emulator page, which keeps its own black theme-color.
  syncThemeColorMeta?: boolean;
}

export const ColorModeProvider = ({ children, syncThemeColorMeta = true }: ColorModeProviderProps) => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const prefersHighContrast = useMediaQuery("(prefers-contrast: more)");

  // Stored choice always wins over OS preference once the user has made one — unlike
  // the pre-M7 provider, which re-synced to the OS preference on every change and would
  // silently stomp a manual toggle. OS preference is only the seed for the very first visit.
  const [mode, setMode] = useState<ColorMode>(() => readStoredMode() ?? (prefersDarkMode ? "dark" : "light"));
  const [contrast, setContrast] = useState<ContrastLevel>(
    () => readStoredContrast() ?? (prefersHighContrast ? "high" : "normal")
  );

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(CONTRAST_STORAGE_KEY, contrast);
  }, [contrast]);

  const [accentColor, setAccentColorState] = useState<string>(readStoredAccent);

  // Only a custom color is stored, so a future change to the default reaches everyone who
  // never picked one.
  useEffect(() => {
    if (isDefaultAccent(accentColor)) localStorage.removeItem(ACCENT_STORAGE_KEY);
    else localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
    // The browser/phone UI color follows the accent, as index.html's static value does for
    // the default. (The installed app's manifest color is fixed at build time.)
    if (syncThemeColorMeta) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", accentColor);
    }
  }, [accentColor, syncThemeColorMeta]);

  const toggleColorMode = () => setMode((prev) => (prev === "light" ? "dark" : "light"));
  const toggleContrast = () => setContrast((prev) => (prev === "normal" ? "high" : "normal"));
  const setAccentColor = (hex: string) => {
    if (HEX_COLOR.test(hex)) setAccentColorState(hex.toLowerCase());
  };
  const resetAccentColor = () => setAccentColorState(DEFAULT_ACCENT_HEX.toLowerCase());

  const theme = useMemo(() => createVgtTheme(mode, contrast, accentColor), [mode, contrast, accentColor]);

  return (
    <ColorModeContext.Provider
      value={{ mode, contrast, accentColor, toggleColorMode, toggleContrast, setAccentColor, resetAccentColor }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
