import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  resolveStoreRegion,
  STORE_REGION_AUTO,
  STORE_REGION_OFF,
  STORE_REGIONS,
} from "../utils/storeRegion";

interface StoreRegionContextValue {
  // What's chosen in Settings: "auto", "off" or a country code.
  setting: string;
  setSetting: (setting: string) => void;
  // The country store links are pointed at, or null to leave them as IGDB has them.
  region: string | null;
  // The country "auto" resolves to in this browser, for showing next to the option.
  detectedRegion: string | null;
}

const browserLanguages = () =>
  typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);

const StoreRegionContext = createContext<StoreRegionContextValue>({
  setting: STORE_REGION_AUTO,
  setSetting: () => {},
  region: null,
  detectedRegion: null,
});

export const useStoreRegion = () => useContext(StoreRegionContext);

const STORE_REGION_STORAGE_KEY = "vgt.storeRegion";

// Storage can be missing or throw (private windows, blocked site data); the setting then
// just falls back to Automatic for this visit.
function readStoredSetting(): string {
  try {
    const stored = window.localStorage.getItem(STORE_REGION_STORAGE_KEY);
    return stored && (stored === STORE_REGION_AUTO || stored === STORE_REGION_OFF || stored in STORE_REGIONS)
      ? stored
      : STORE_REGION_AUTO;
  } catch {
    return STORE_REGION_AUTO;
  }
}

export const StoreRegionProvider = ({ children }: { children: ReactNode }) => {
  const [setting, setSetting] = useState<string>(() => readStoredSetting());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_REGION_STORAGE_KEY, setting);
    } catch {
      // Not remembered for next time, but still applied for this visit.
    }
  }, [setting]);

  const value = useMemo(() => {
    const languages = browserLanguages();
    return {
      setting,
      setSetting,
      region: resolveStoreRegion(setting, languages),
      detectedRegion: resolveStoreRegion(STORE_REGION_AUTO, languages),
    };
  }, [setting]);

  return <StoreRegionContext.Provider value={value}>{children}</StoreRegionContext.Provider>;
};
