import { lazy, Suspense, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SlideshowIcon from "@mui/icons-material/SlideshowOutlined";
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEnabledLabs } from "../hooks/useLabs";
import { screensaverSampleOptions } from "../hooks/useScreensaver";
import { SIDEBAR_WIDTH } from "../navigation/Sidebar";
import { enterFullscreen } from "../utils/fullscreen";

// The overlay's code is only fetched the first time it's wanted (hovering the button is
// enough), so the lab adds nothing to every other page's load.
const loadScreensaver = () => import("./Screensaver");
const Screensaver = lazy(loadScreensaver);

// Space the toasts leave above the button on phones (see ToastStyles' `raised`), where they
// span the screen's width: the button's size plus its margin and a gap. From `sm` up the
// toasts sit bottom right and the button bottom left, so they never meet.
export const SCREENSAVER_BUTTON_CLEARANCE_XS = 40 + 12 + 12;

// Whether the screensaver is open lives in the history entry's state, not in React state:
// opening it pushes an entry, so Back (or a phone's back gesture) closes it and leaving it for
// a game replaces that entry. Browsers keep an entry's state across a reload, so the entry
// carries a token this page load handed out: after a reload it's unknown, and the screensaver
// stays closed.
const openedThisLoad = new Set<string>();

export function useScreensaverOpen(): boolean {
  const { state } = useLocation();
  const token = (state as { screensaver?: unknown } | null)?.screensaver;
  return typeof token === "string" && openedThisLoad.has(token);
}

export function useScreensaverButtonShown(): boolean {
  return useEnabledLabs().has("screensaver");
}

// The Screensaver lab's floating button, on every signed-in page (it's mounted in AppShell, so
// never on sign-in, the share pages or the separate emulator player), and the screensaver it
// opens.
const ScreensaverButton = () => {
  const { t } = useTranslation();
  const shown = useScreensaverButtonShown();
  const open = useScreensaverOpen();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const warmUp = useCallback(() => {
    void loadScreensaver();
    void queryClient.prefetchQuery(screensaverSampleOptions);
  }, [queryClient]);

  if (!shown) return null;

  const start = () => {
    // Fullscreen needs a click to ask from, so it's asked here rather than by the overlay.
    enterFullscreen();
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    openedThisLoad.add(token);
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { state: { ...((location.state as object | null) ?? {}), screensaver: token } }
    );
  };

  return (
    <>
      {open ? null : (
        <Tooltip title={t("screensaver.start")} placement="right">
          <Fab
            color="primary"
            aria-label={t("screensaver.start")}
            onClick={start}
            onMouseEnter={warmUp}
            onFocus={warmUp}
            onTouchStart={warmUp}
            sx={{
              // Bottom left of the page, beside the sidebar on desktop: the right edge has the
              // lists' A–Z rails and the toasts.
              position: "fixed",
              left: { xs: 12, sm: 16, md: SIDEBAR_WIDTH + 16 },
              bottom: { xs: "calc(12px + env(safe-area-inset-bottom))", sm: 16 },
              zIndex: (theme) => theme.zIndex.speedDial,
              width: { xs: 40, sm: 56 },
              height: { xs: 40, sm: 56 },
              minHeight: 0,
            }}
          >
            <SlideshowIcon />
          </Fab>
        </Tooltip>
      )}
      {open ? (
        <Suspense fallback={null}>
          <Screensaver />
        </Suspense>
      ) : null}
    </>
  );
};

export default ScreensaverButton;
