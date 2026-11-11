import { useEffect, useState } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

// Keeps the screen on while `active` (the Screensaver). It asks for a Screen Wake Lock, asked
// again whenever the page comes back into view (browsers drop it when the page is hidden).
// Where there's no Wake Lock or it's refused (it needs HTTPS or localhost, and a home server
// on plain HTTP has neither), it returns true: the caller then plays a tiny muted looping
// video, which keeps most browsers' screens on too.
export function useKeepAwake(active: boolean): boolean {
  const [needsVideo, setNeedsVideo] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) {
      setNeedsVideo(true);
      return () => setNeedsVideo(false);
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) {
            void lock.release().catch(() => undefined);
            return;
          }
          sentinel = lock;
          setNeedsVideo(false);
        })
        .catch(() => {
          if (!cancelled) setNeedsVideo(true);
        });
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release().catch(() => undefined);
      setNeedsVideo(false);
    };
  }, [active]);

  return needsVideo;
}
