import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  fetchDisplayModeSettings,
  fetchDisplayModeSlides,
  type DisplayModeSlide,
} from "../api/displayMode";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

// Minimal typings for the YouTube IFrame Player API (loaded on demand).
interface YTPlayerLike {
  destroy: () => void;
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getPlayerState: () => number;
}
interface YTStateChangeEvent {
  data: number;
  target: YTPlayerLike;
}
interface YTNamespaceLike {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YTPlayerLike }) => void;
        onStateChange?: (event: YTStateChangeEvent) => void;
        onError?: () => void;
      };
    }
  ) => YTPlayerLike;
  PlayerState: { ENDED: number; PLAYING: number; BUFFERING: number };
}

let ytApiPromise: Promise<YTNamespaceLike> | null = null;
function loadYouTubeApi(): Promise<YTNamespaceLike> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<YTNamespaceLike>((resolve, reject) => {
    const w = window as unknown as {
      YT?: YTNamespaceLike;
      onYouTubeIframeAPIReady?: () => void;
    };
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }
    const timeout = window.setTimeout(() => reject(new Error("yt api timeout")), 15000);
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timeout);
      if (w.YT) resolve(w.YT);
      else reject(new Error("yt api missing"));
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("yt api failed"));
    };
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function youtubeVideoId(embedUrl: string): string | null {
  const match = embedUrl.match(/\/embed\/([^/?#]+)/);
  return match ? match[1] : null;
}

/** A YouTube slide that plays in full with sound, then calls onEnded. */
const VideoSlide = ({
  embedUrl,
  volume,
  onEnded,
  onFailed,
}: {
  embedUrl: string;
  volume: number;
  onEnded: () => void;
  onFailed: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onEnded, onFailed, volume });
  callbacksRef.current = { onEnded, onFailed, volume };

  useEffect(() => {
    const videoId = youtubeVideoId(embedUrl);
    const host = playerHostRef.current;
    if (!videoId || !host) {
      onFailed();
      return;
    }
    let player: YTPlayerLike | null = null;
    let cancelled = false;
    let soundCheckTimer = 0;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !playerHostRef.current) return;
        // The API replaces the host div with its iframe, so centering lives on
        // the wrapper (flex) — the iframe is styled as the wrapper's child.
        //
        // Sound strategy: try unmuted at the user's volume. Browsers only
        // allow unmuted autoplay after the user has interacted with the site;
        // if it's blocked, the player never leaves the unstarted state, and
        // only then do we fall back to muted so the video still plays.
        // Buffering counts as progress — we must NOT mute a video that is
        // simply slow to load (common on older devices).
        let everStarted = false;
        try {
          player = new YT.Player(host, {
            videoId,
            playerVars: {
              autoplay: 1,
              rel: 0,
              controls: 0,
              playsinline: 1,
              iv_load_policy: 3,
            },
            events: {
              onReady: (event) => {
                try {
                  event.target.unMute();
                  event.target.setVolume(callbacksRef.current.volume);
                  event.target.playVideo();
                } catch {
                  // ignored — the sound check below handles a stall
                }
                soundCheckTimer = window.setTimeout(() => {
                  if (cancelled || !player || everStarted) return;
                  try {
                    player.mute();
                    player.playVideo();
                  } catch {
                    // ignored
                  }
                }, 8000);
              },
              onStateChange: (event) => {
                if (
                  event.data === YT.PlayerState.PLAYING ||
                  event.data === YT.PlayerState.BUFFERING
                ) {
                  everStarted = true;
                }
                if (event.data === YT.PlayerState.ENDED) callbacksRef.current.onEnded();
              },
              onError: () => callbacksRef.current.onFailed(),
            },
          });
        } catch {
          // The player constructor can throw (e.g. API in a bad state) —
          // skip the slide instead of crashing the page.
          if (!cancelled) callbacksRef.current.onFailed();
        }
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onFailed();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(soundCheckTimer);
      try {
        player?.destroy();
      } catch {
        // YouTube's destroy() is known to throw during teardown; the
        // slideshow must survive it instead of tripping the error boundary.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedUrl]);

  return (
    <Box
      ref={containerRef}
      sx={{
        // "Fit": the whole 16:9 video is visible, letterboxed on screens with
        // a different aspect ratio instead of being cropped.
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // pointerEvents none so tapping the video still exits to the dashboard
        "& > iframe": {
          border: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        },
      }}
    >
      <div ref={playerHostRef} style={{ width: "100%", height: "100%" }} />
    </Box>
  );
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FADE_MS = 600;
// Safety cap: if a video's end event never arrives, move on after 10 minutes
// rather than hanging on one slide forever.
const VIDEO_MAX_MS = 10 * 60 * 1000;

const DisplayModePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [slides, setSlides] = useState<DisplayModeSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [showTitle, setShowTitle] = useState(false);
  const [volume, setVolume] = useState(80);
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);
  const fetchingRef = useRef(false);

  // Keep the screen awake while the slideshow runs (phones, tablets, TVs).
  // Two layers, first available wins:
  // 1. The Wake Lock API (HTTPS only — silently absent on plain HTTP).
  // 2. A hidden looping video, which keeps the screen on even on insecure
  //    origins where the Wake Lock API is unavailable.
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    let fallbackVideo: HTMLVideoElement | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
        };
        if (!nav.wakeLock) {
          startVideoFallback();
          return;
        }
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
        } else {
          lock = sentinel;
        }
      } catch {
        // Wake Lock unsupported or denied — fall back to the looping video.
        startVideoFallback();
      }
    };
    const startVideoFallback = () => {
      if (fallbackVideo || cancelled) return;
      const video = document.createElement("video");
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.loop = true;
      video.src = "/keep-awake.mp4";
      video.style.cssText =
        "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;";
      document.body.appendChild(video);
      fallbackVideo = video;
      video.play().catch(() => {});
    };
    request();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (lock) lock.release().catch(() => {});
      if (fallbackVideo) {
        fallbackVideo.pause();
        fallbackVideo.remove();
        fallbackVideo = null;
      }
    };
  }, []);

  // Load settings and the first batch of slides.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings, firstBatch] = await Promise.all([
          fetchDisplayModeSettings(),
          fetchDisplayModeSlides(),
        ]);
        if (cancelled) return;
        setIntervalSeconds(settings.slideIntervalSeconds);
        setShowTitle(settings.showTitle);
        setVolume(settings.volume);
        setSlides(shuffle(firstBatch));
      } catch {
        // surfaced via the empty state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchMore = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const batch = await fetchDisplayModeSlides();
      if (batch.length > 0) {
        setSlides((prev) => [...prev, ...shuffle(batch)]);
      }
    } catch {
      // A failed refill just means the current loop repeats.
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
    setFading(false);
  }, [slides.length]);

  const slide: DisplayModeSlide | undefined =
    slides.length > 0 ? slides[index % slides.length] : undefined;
  const isVideo = slide?.mediaType === "video";

  // Advance on the configured interval for images; videos play in full and
  // override the timer (with a safety cap in case the end event never fires).
  useEffect(() => {
    if (loading || slides.length === 0) return;
    if (index >= slides.length - 5) void fetchMore();
    if (isVideo) {
      const cap = window.setTimeout(() => advance(), VIDEO_MAX_MS);
      return () => window.clearTimeout(cap);
    }
    const durationMs = Math.max(intervalSeconds, 1) * 1000;
    const fadeTimer = window.setTimeout(() => setFading(true), Math.max(durationMs - FADE_MS, 0));
    const advanceTimer = window.setTimeout(() => advance(), durationMs);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [index, slides, loading, intervalSeconds, isVideo, fetchMore, advance]);

  // Preload the next image so transitions never flash (videos load on demand).
  useEffect(() => {
    if (slides.length === 0) return;
    const next = slides[(index + 1) % slides.length];
    if (next.mediaType === "video") return;
    const img = new Image();
    img.src = next.mediaUrl;
  }, [index, slides]);

  if (loading) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          bgcolor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress sx={{ color: "white" }} />
      </Box>
    );
  }

  if (slides.length === 0 || !slide) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          bgcolor: "black",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: "white", textAlign: "center" }}>
          {t("displayMode.noSlides")}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "rgba(255, 255, 255, 0.7)", textAlign: "center" }}
        >
          {t("displayMode.noSlidesHint")}
        </Typography>
        <Button variant="contained" onClick={() => navigate("/")}>
          {t("displayMode.backToDashboard")}
        </Button>
      </Box>
    );
  }

  const slideKey = `${slide.id}-${slide.mediaType}-${slide.mediaUrl}`;

  return (
    <Box
      onClick={() => navigate("/")}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        bgcolor: "black",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {isVideo ? (
        <VideoSlide
          key={slideKey}
          embedUrl={slide.mediaUrl}
          volume={volume}
          onEnded={advance}
          onFailed={advance}
        />
      ) : (
        <Box
          component="img"
          key={slideKey}
          src={slide.mediaUrl}
          alt={slide.name}
          onError={advance}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        />
      )}
      {showTitle && (
        <Typography
          variant="h6"
          sx={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: "center",
            color: "white",
            px: 2,
            textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        >
          {slide.name}
        </Typography>
      )}
    </Box>
  );
};

export default DisplayModePage;
