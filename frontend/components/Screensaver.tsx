import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Portal from "@mui/material/Portal";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resolveImageUrl } from "../api/client";
import type { ScreensaverGame } from "../api/types";
import { useKeepAwake } from "../hooks/useKeepAwake";
import { screensaverSampleOptions, useScreensaverInterval, useScreensaverSample } from "../hooks/useScreensaver";
import { exitFullscreen } from "../utils/fullscreen";
import { gameIdentifier } from "../utils/identifiers";
import { avoidRepeat, hasEveryCover, shuffleDeck } from "../utils/screensaverDeck";
import ConfirmDialog from "./ConfirmDialog";

// Auto mode comes back after this long without a swipe, key, tap or pointer movement.
export const IDLE_RESUME_MS = 8000;
// The close button hides again after this long without pointer movement.
const CONTROLS_HIDE_MS = 3000;
// A tap: a press and release this close together, in distance and time.
const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 500;
// A swipe past this share of the width (or a flick faster than this) changes the cover.
const SWIPE_SHARE = 0.15;
const FLICK_PX_PER_MS = 0.5;
const SLIDE_MS = 600;
// Auto mode waits for the next cover to download (checked this often), but no longer than this.
const LOAD_POLL_MS = 250;
const LOAD_WAIT_MS = 5000;

const coverSrc = (game: ScreensaverGame) => resolveImageUrl(game.coverUrl, "t_1080p") ?? undefined;

interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  at: number;
  dragging: boolean;
}

// One cover over a blurred, darkened copy of itself.
const Slide = ({ game, label, fade }: { game: ScreensaverGame; label?: string; fade?: boolean }) => {
  const src = coverSrc(game);
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(fade ? { animation: "vgt-screensaver-fade 600ms ease" } : {}),
        "@keyframes vgt-screensaver-fade": { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Box
        component="img"
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.4)",
          transform: "scale(1.2)",
        }}
      />
      <Box
        component="img"
        src={src}
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        draggable={false}
        sx={{
          position: "relative",
          maxWidth: "92vw",
          maxHeight: "92vh",
          objectFit: "contain",
          borderRadius: 1,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
        }}
      />
    </Box>
  );
};

// The Screensaver lab: your game covers full screen, one after another (see ScreensaverButton
// for how it opens and closes). Swipes, arrow keys and taps pause it; it carries on by itself
// after IDLE_RESUME_MS. Tapping a cover offers to open that game.
const Screensaver = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { seconds } = useScreensaverInterval();
  const { data, isError, refetch, isFetching } = useScreensaverSample();

  const [deck, setDeck] = useState<ScreensaverGame[] | null>(null);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  // The order after the last cover, prepared while the last one shows, so the slide into it
  // shows the cover that really comes next.
  const [upcoming, setUpcoming] = useState<ScreensaverGame[] | null>(null);
  // A slide animation in progress (-1 back, 1 forward), and the finger's offset while dragging.
  const [moving, setMoving] = useState<-1 | 1 | null>(null);
  const [dragX, setDragX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirming, setConfirming] = useState<ScreensaverGame | null>(null);
  const [controlsShown, setControlsShown] = useState(true);
  const [hidden, setHidden] = useState(() => document.visibilityState === "hidden");
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  // Covers already downloaded: a ref, so each finished download doesn't restart auto mode.
  const loadedRef = useRef(new Set<string>());
  const preparing = useRef(false);
  const idleTimer = useRef<number>();
  const controlsTimer = useRef<number>();

  const needsVideo = useKeepAwake(true);

  // The first sample becomes the deck; later ones are asked for when it runs out (below).
  useEffect(() => {
    if (data && deck === null) {
      setDeck(data.games);
      setTotal(data.total);
    }
  }, [data, deck]);

  const close = useCallback(() => navigate(-1), [navigate]);

  // Locks the page behind, takes focus, and leaves fullscreen on the way out. The lock is on
  // <html>, not <body>: the confirm dialog locks <body> itself and puts back what it found
  // there after this cleanup has run, which would leave the page locked.
  useEffect(() => {
    const root = document.documentElement;
    const { overflow } = root.style;
    root.style.overflow = "hidden";
    rootRef.current?.focus();
    return () => {
      root.style.overflow = overflow;
      exitFullscreen();
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(controlsTimer.current);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const showControls = useCallback(() => {
    setControlsShown(true);
    window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setControlsShown(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => showControls(), [showControls]);

  // Pauses auto mode, and (re)starts the countdown to resume it.
  const pause = useCallback(() => {
    setPaused(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setPaused(false), IDLE_RESUME_MS);
  }, []);

  // Activity while already paused (a pointer moving, the wheel) keeps it paused for longer.
  const keepPaused = useCallback(() => {
    if (paused) pause();
  }, [paused, pause]);

  const count = deck?.length ?? 0;
  const current = deck && count > 0 ? deck[Math.min(index, count - 1)] : null;
  const onLast = Boolean(deck && count > 1 && index === count - 1);
  const nextGame = !deck || count < 2 ? null : onLast ? (upcoming?.[0] ?? null) : deck[index + 1];
  const previousGame = !deck || count < 2 ? null : deck[(index - 1 + count) % count];

  // On the last cover, the next order: a library that fit in one sample is reshuffled here; a
  // larger one gets a new sample from the server. Either way the cover on screen doesn't come
  // straight back.
  useEffect(() => {
    if (!deck || !onLast || upcoming || preparing.current) return;
    const currentId = deck[index]?.id ?? null;
    if (hasEveryCover(deck.length, total)) {
      setUpcoming(shuffleDeck(deck, currentId));
      return;
    }
    preparing.current = true;
    queryClient
      .fetchQuery({ ...screensaverSampleOptions, staleTime: 0 })
      .then((next) => {
        setTotal(next.total);
        setUpcoming(next.games.length > 0 ? avoidRepeat([...next.games], currentId) : shuffleDeck(deck, currentId));
      })
      .catch(() => setUpcoming(shuffleDeck(deck, currentId)))
      .finally(() => {
        preparing.current = false;
      });
  }, [deck, onLast, upcoming, index, total, queryClient]);

  const step = useCallback(
    (direction: -1 | 1) => {
      if (!deck || deck.length === 0) return;
      if (direction === 1 && index >= deck.length - 1) {
        if (!upcoming) return;
        setDeck(upcoming);
        setUpcoming(null);
        setIndex(0);
        return;
      }
      setIndex((at) => (at + direction + deck.length) % deck.length);
    },
    [deck, index, upcoming]
  );

  // Moves one cover, sliding (or, with reduced motion, fading) to it.
  const go = useCallback(
    (direction: -1 | 1) => {
      if (!deck || deck.length < 2 || moving) return;
      if (direction === 1 && !nextGame) return;
      if (reducedMotion) {
        step(direction);
        setDragX(0);
        return;
      }
      setSnapping(false);
      setMoving(direction);
    },
    [deck, moving, nextGame, reducedMotion, step]
  );

  // A slide ends on transitionend, but browsers skip that event when the page stops drawing
  // mid-slide (a hidden tab, a window behind another); this finishes it anyway, so the
  // carousel never stays stuck half-way with auto mode stopped.
  useEffect(() => {
    if (!moving) return undefined;
    const timer = window.setTimeout(() => {
      step(moving);
      setMoving(null);
      setDragX(0);
      setSnapping(false);
    }, SLIDE_MS + 150);
    return () => window.clearTimeout(timer);
  }, [moving, step]);

  const onTrackTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (moving) {
      step(moving);
      setMoving(null);
      setDragX(0);
    }
    setSnapping(false);
  };

  // Covers that won't load are skipped, so a dead link never sits on screen.
  const markFailed = useCallback((game: ScreensaverGame) => {
    setFailed((prev) => new Set(prev).add(game.id));
  }, []);

  // Downloads the neighbours ahead of time, so a slide never shows a half-loaded cover.
  useEffect(() => {
    for (const game of [nextGame, previousGame]) {
      const src = game ? coverSrc(game) : undefined;
      if (!game || !src || loadedRef.current.has(src)) continue;
      const image = new Image();
      image.onload = () => loadedRef.current.add(src);
      image.onerror = () => markFailed(game);
      image.src = src;
    }
  }, [nextGame, previousGame, markFailed]);

  // A cover that failed is passed straight away.
  useEffect(() => {
    if (current && failed.has(current.id) && count > failed.size && !moving) step(1);
  }, [current, failed, count, moving, step]);

  // Auto mode: the next cover after the chosen time, once it has downloaded.
  const autoRunning = Boolean(nextGame && !paused && !confirming && !hidden && !moving);
  const nextSrc = nextGame ? coverSrc(nextGame) : undefined;
  useEffect(() => {
    if (!autoRunning) return undefined;
    let pollTimer: number | undefined;
    const timer = window.setTimeout(() => {
      const waitUntil = Date.now() + LOAD_WAIT_MS;
      const advanceWhenLoaded = () => {
        if (!nextSrc || loadedRef.current.has(nextSrc) || Date.now() >= waitUntil) {
          go(1);
          return;
        }
        pollTimer = window.setTimeout(advanceWhenLoaded, LOAD_POLL_MS);
      };
      advanceWhenLoaded();
    }, seconds * 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(pollTimer);
    };
    // Restarts with each cover (index) and whenever auto mode is held up.
  }, [autoRunning, index, seconds, nextSrc, go]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirming) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        pause();
        showControls();
        go(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, pause, showControls, go, close]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (confirming || moving || event.button > 0) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: Date.now(),
      dragging: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    showControls();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    showControls();
    keepPaused();
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging && Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) {
      gesture.dragging = true;
      pause();
    }
    if (gesture.dragging && !reducedMotion) setDragX(dx);
  };

  // Springs the cover back after a drag too short to change it (no animation if it never moved).
  const snapBack = (dx: number) => {
    setSnapping(dx !== 0 && !reducedMotion);
    setDragX(0);
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const dx = event.clientX - gesture.x;
    const elapsed = Date.now() - gesture.at;
    if (cancelled) {
      snapBack(dx);
      return;
    }
    if (!gesture.dragging) {
      if (elapsed <= TAP_MAX_MS && current) {
        pause();
        setConfirming(current);
      }
      return;
    }
    const width = stageRef.current?.clientWidth || window.innerWidth;
    const flick = Math.abs(dx) / Math.max(elapsed, 1) > FLICK_PX_PER_MS;
    const direction = dx < 0 ? 1 : -1;
    if ((Math.abs(dx) > width * SWIPE_SHARE || flick) && (direction === -1 ? previousGame : nextGame)) {
      go(direction);
    } else {
      snapBack(dx);
    }
  };

  const openGame = () => {
    if (!confirming) return;
    navigate(`/game/${gameIdentifier(confirming)}`, { replace: true });
  };

  const cancelConfirm = () => {
    setConfirming(null);
    pause();
  };

  const trackOffset = moving ? `${-moving * 100}%` : `${dragX}px`;
  const animate = !reducedMotion && (moving !== null || snapping);

  let body;
  if (isError && !deck) {
    body = (
      <Box sx={{ textAlign: "center", color: "common.white", px: 3 }}>
        <Typography sx={{ mb: 2 }}>{t("screensaver.loadFailed")}</Typography>
        <Button variant="contained" onClick={() => void refetch()} disabled={isFetching}>
          {t("screensaver.retry")}
        </Button>
      </Box>
    );
  } else if (!deck) {
    body = <CircularProgress aria-label={t("common.loading")} sx={{ color: "common.white" }} />;
  } else if (!current) {
    body = (
      <Box sx={{ textAlign: "center", color: "common.white", px: 3, maxWidth: 480 }}>
        <Typography sx={{ mb: 2 }}>{t("screensaver.empty")}</Typography>
        <Button variant="contained" onClick={close}>
          {t("common.close")}
        </Button>
      </Box>
    );
  } else {
    body = (
      <Box
        ref={stageRef}
        data-testid="screensaver-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endGesture(event, false)}
        onPointerCancel={(event) => endGesture(event, true)}
        sx={{ position: "absolute", inset: 0, touchAction: "none", cursor: "pointer", userSelect: "none" }}
      >
        <Box
          data-testid="screensaver-track"
          onTransitionEnd={onTrackTransitionEnd}
          sx={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${trackOffset})`,
            transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : "none",
          }}
        >
          {previousGame && !reducedMotion ? (
            <Box sx={{ position: "absolute", inset: 0, transform: "translateX(-100%)" }} aria-hidden>
              <Slide game={previousGame} />
            </Box>
          ) : null}
          <Box key={reducedMotion ? current.id : undefined} sx={{ position: "absolute", inset: 0 }}>
            <Slide
              game={current}
              fade={reducedMotion}
              label={t("screensaver.slide", { name: current.name, position: index + 1, count })}
            />
          </Box>
          {nextGame && !reducedMotion ? (
            <Box sx={{ position: "absolute", inset: 0, transform: "translateX(100%)" }} aria-hidden>
              <Slide game={nextGame} />
            </Box>
          ) : null}
        </Box>
        {/* Reports a cover that won't load, so it's skipped. */}
        <img src={coverSrc(current)} alt="" hidden onError={() => markFailed(current)} />
      </Box>
    );
  }

  return (
    <Portal>
      <Box
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("screensaver.label")}
        tabIndex={-1}
        onWheel={() => {
          showControls();
          keepPaused();
        }}
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: (theme) => theme.zIndex.modal,
          bgcolor: "common.black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: "none",
          overflow: "hidden",
          cursor: controlsShown ? "auto" : "none",
        }}
      >
        {body}
        {/* Top right: the close button (shown on activity) beside VGT's badge (always there,
            so whoever walks past knows what this is). The badge lets taps through to the cover. */}
        <Box
          sx={{
            position: "absolute",
            top: "calc(12px + env(safe-area-inset-top))",
            right: "calc(12px + env(safe-area-inset-right))",
            display: "flex",
            alignItems: "center",
            gap: 1,
            pointerEvents: "none",
          }}
        >
          <IconButton
            onClick={close}
            aria-label={t("screensaver.close")}
            sx={{
              pointerEvents: "auto",
              color: "common.white",
              bgcolor: "rgba(0, 0, 0, 0.45)",
              "&:hover": { bgcolor: "rgba(0, 0, 0, 0.65)" },
              opacity: controlsShown ? 1 : 0,
              transition: "opacity 300ms ease",
              "&:focus-visible": { opacity: 1 },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            data-testid="screensaver-brand"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pl: 0.75,
              pr: { xs: 0.75, sm: 1.5 },
              py: 0.75,
              borderRadius: 999,
              bgcolor: "rgba(0, 0, 0, 0.45)",
              backdropFilter: "blur(6px)",
              color: "common.white",
              opacity: 0.9,
            }}
          >
            <Box component="img" src="/icon-master.svg" alt="" sx={{ width: 26, height: 26, display: "block" }} />
            <Typography
              component="span"
              sx={{
                display: { xs: "none", sm: "inline" },
                fontWeight: 650,
                fontSize: 14,
                letterSpacing: "-0.01em",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
              }}
            >
              VideoGameTrackarr
            </Typography>
          </Box>
        </Box>
        {needsVideo ? (
          <video
            src="/keep-awake.mp4"
            muted
            loop
            autoPlay
            playsInline
            aria-hidden
            data-testid="screensaver-keep-awake"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        ) : null}
        <ConfirmDialog
          open={confirming !== null}
          title={t("screensaver.confirmTitle")}
          description={t("screensaver.confirmText", { name: confirming?.name ?? "" })}
          confirmLabel={t("screensaver.confirmGo")}
          onClose={cancelConfirm}
          onConfirm={openGame}
        />
      </Box>
    </Portal>
  );
};

export default Screensaver;
