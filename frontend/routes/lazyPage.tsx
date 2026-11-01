import type { ComponentType } from "react";

// Every page but the sign-in, the Overview and the error pages loads as its own file the
// first time it's opened (see router.tsx), so the first visit downloads only what it shows
// (and the service worker precaches the rest for offline use). A tab still running the
// previous release can ask for a page file that release deleted; that reloads the app once
// to pick up the new release instead of showing the error page.
const pageLoaders: Array<() => Promise<unknown>> = [];
export const RELOADED_FOR_UPDATE = "vgt-reloaded-for-update";

const storage = {
  get: (key: string) => {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch {
      // Storage blocked: the worst case is the error page instead of one reload.
    }
  },
};

// A route's `lazy` for the page `load` imports.
export const page = (load: () => Promise<{ default: ComponentType }>) => {
  pageLoaders.push(load);
  return async () => {
    let Page: ComponentType;
    try {
      ({ default: Page } = await load());
    } catch (error) {
      if (!storage.get(RELOADED_FOR_UPDATE)) {
        storage.set(RELOADED_FOR_UPDATE, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    }
    storage.set(RELOADED_FOR_UPDATE, null);
    return { element: <Page /> };
  };
};

// Fetches every page's code in the background, so a click later doesn't wait for it. A
// failure is ignored: opening that page tries again (and reloads if it must).
export const preloadPages = () => pageLoaders.forEach((load) => void load().catch(() => {}));
