import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { createM3Theme } from "./createM3Theme";
import type { ColorMode, ContrastLevel } from "./m3Colors";

interface ColorModeContextValue {
  mode: ColorMode;
  contrast: ContrastLevel;
  toggleColorMode: () => void;
  toggleContrast: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "light",
  contrast: "normal",
  toggleColorMode: () => {},
  toggleContrast: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

const MODE_STORAGE_KEY = "vgt.colorMode";
const CONTRAST_STORAGE_KEY = "vgt.contrast";

function readStoredMode(): ColorMode | null {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function readStoredContrast(): ContrastLevel | null {
  const stored = localStorage.getItem(CONTRAST_STORAGE_KEY);
  return stored === "normal" || stored === "high" ? stored : null;
}

export const ColorModeProvider = ({ children }: { children: ReactNode }) => {
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

  const toggleColorMode = () => setMode((prev) => (prev === "light" ? "dark" : "light"));
  const toggleContrast = () => setContrast((prev) => (prev === "normal" ? "high" : "normal"));

  const theme = useMemo(() => createM3Theme(mode, contrast), [mode, contrast]);

  return (
    <ColorModeContext.Provider value={{ mode, contrast, toggleColorMode, toggleContrast }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
