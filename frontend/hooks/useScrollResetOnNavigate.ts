import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Disabling the browser's own per-history-entry restoration once, for the whole app: it does a
// single scroll attempt tied to the `popstate` event, before React has re-rendered the target
// route or async data has loaded — on a page whose real height only exists once data arrives
// (e.g. VirtualGameGrid, see that component's own restoration logic), that one-shot attempt
// clamps to whatever short page exists at that instant and never retries. Turning it off and
// doing our own restore (below) after the fact avoids the two fighting each other.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const SAVE_THROTTLE_MS = 100;
// Session-lifetime only (in-memory, not sessionStorage) — resets on a hard reload, which is
// fine, since the bug this fixes only ever involves in-app client-side navigation.
const scrollYByLocation = new Map<string, number>();

function locationKey(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

// Restores the previous scroll position on browser back/forward ("POP"), using our own saved
// value rather than the browser's native restoration (disabled above) — and resets to the top
// on a fresh navigation (clicking a nav link/sub-nav chip — "PUSH", or a redirect — "REPLACE").
// Client-side routing never touches scroll on its own, so without this a PUSH/REPLACE would
// carry over whatever scroll offset the previous, possibly much longer, page left behind.
//
// This is the generic, pixel-based fallback suitable for ordinary pages. A page built around
// VirtualGameGrid needs more than this — its real height only exists once async data has
// loaded, so restoring a pixel offset immediately on mount (before that happens) just clamps to
// 0 — see that component's own item-key-based restoration, which corrects this hook's rough
// pixel jump once real content is ready.
export function useScrollResetOnNavigate(): void {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const lastSaveAtRef = useRef(0);

  useEffect(() => {
    const key = locationKey(pathname, search);
    if (navigationType === "POP") {
      window.scrollTo(0, scrollYByLocation.get(key) ?? 0);
    } else {
      window.scrollTo(0, 0);
    }

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastSaveAtRef.current < SAVE_THROTTLE_MS) return;
      lastSaveAtRef.current = now;
      scrollYByLocation.set(key, window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);
}
