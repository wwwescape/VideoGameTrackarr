import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";

// Keeps Back predictable around the detail pages (game, add-on, device, accessory, event).
//
// - A detail page's Back button steps back exactly once when it was reached from inside the
//   app, landing on that page with its scroll; opened from a bookmark or a reload there's
//   nothing to step back to, and it goes to the section's list.
// - An edit page opened from its detail page carries `fromDetail`. Saving or cancelling then
//   steps back to that same history entry rather than pushing a second copy of the detail page,
//   which is what used to make Back land on the edit page.
export interface NavState {
  fromDetail?: boolean;
}

const navState = (location: Location): NavState | null => (location.state as NavState | null) ?? null;

// The first page of a session (a bookmark, a reload, a new tab) has React Router's "default"
// key; anything reached inside the app has its own.
const hasInAppHistory = (location: Location) => location.key !== "default";

// Detail pages: where Back goes, and whether it goes to the list (for the button's label).
export function useDetailBack(listPath: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const inApp = hasInAppHistory(location);
  const back = useCallback(() => {
    if (inApp) navigate(-1);
    else navigate(listPath);
  }, [inApp, listPath, navigate]);
  return { back, toList: !inApp };
}

// State for a detail page's Edit button, so the edit page can return without growing history.
export const editFromDetail: NavState = { fromDetail: true };

// Edit pages: return to the item's page after saving or cancelling, without growing history.
export function useEditReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromDetail = Boolean(navState(location)?.fromDetail);
  return useCallback(
    (detailPath: string) => {
      if (fromDetail) navigate(-1);
      else navigate(detailPath, { replace: true });
    },
    [fromDetail, navigate]
  );
}

// Detail pages whose address includes the item's name (custom games, hardware): after a
// rename, or when opened by another valid form of the address (a bare uuid), correct the
// address in place — same history entry, same hash and state.
export function useCanonicalAddress(canonicalPath: string | null) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (canonicalPath && decodeURIComponent(location.pathname) !== canonicalPath) {
      navigate(`${canonicalPath}${location.search}${location.hash}`, { replace: true, state: location.state });
    }
  }, [canonicalPath, location.pathname, location.search, location.hash, location.state, navigate]);
}

// "Back to search" in the add flow: always opened from the page before, so step back to it
// (keeping its search and scroll); opened directly, go to `fallback` instead.
export function useStepBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (fallback: string) => {
      if (hasInAppHistory(location)) navigate(-1);
      else navigate(fallback);
    },
    [location, navigate]
  );
}
