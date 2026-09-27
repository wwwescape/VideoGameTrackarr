// Search keywords, filters and sort choices are remembered per page for the current browser
// session only (sessionStorage: this tab, until it's closed), so leaving a page and coming
// back restores it as it was — without anything leaking into another tab or a later visit.
// See hooks/useSessionState.ts.
const PREFIX = "vgt.view.";

export function readSessionValue<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // Storage blocked (private mode, disabled site data) or a value that isn't valid JSON —
    // either way, behave exactly like plain useState.
    return fallback;
  }
}

export function writeSessionValue(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota/blocked storage: the page still works, it just won't remember this value.
  }
}

/** Removes every remembered page state — called on logout (see api/tokenStorage.ts). */
export function clearSessionViewState(): void {
  try {
    const storage = window.sessionStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
