import { useCallback, useState } from "react";

const PREFIX = "vgt.pref.";

// A display preference kept in this browser across visits (a list's view mode, card size),
// unlike useSessionState, which forgets when the tab closes. Storage can throw (private mode,
// blocked site data), so every access falls back to plain state.
export function useLocalPreference<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(next));
      } catch {
        // The page still works; it just won't remember next time.
      }
    },
    [key]
  );

  return [value, update];
}
