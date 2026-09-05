import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Resets the window scroll to the top on a fresh navigation (clicking a nav link/sub-nav
// chip — a "PUSH", or a redirect — "REPLACE"), but deliberately leaves browser back/forward
// ("POP") alone. Client-side routing never resets scroll on its own — the window just stays
// wherever it was on the previous page — which is what let a stale scroll offset carry over
// onto a freshly-navigated-to page and made VirtualGameGrid render blank cards (it windows
// rows around the current scroll position, so a leftover offset from a longer previous page
// could put the initial render below any real content until it settled).
//
// Deliberately NOT using react-router-dom's <ScrollRestoration /> here: it takes over restoring
// scroll on POP navigations too, but that requires it to successfully save/replay positions
// itself — verified live that it doesn't reliably do so in this app (confirmed against its own
// source: it only persists to sessionStorage on the browser's `pagehide` event, which never
// fires for an in-app client-side route change) — and mounting it also flips
// `history.scrollRestoration` to `"manual"`, switching off the browser's own native
// scroll-per-history-entry restoration, which was already handling the back-button case
// correctly on its own (`"auto"` is the browser default, untouched here). This hook only adds
// the one behavior that was actually missing.
export function useScrollResetOnNavigate(): void {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
