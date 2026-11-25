import { useEffect, type RefObject } from "react";
import { loadGuidePosition, saveGuidePosition } from "../../utils/guideReaderPosition";

const SAVE_EVERY_MS = 1000;

// For the Word/Markdown and text views: once `ready`, scroll back to where this document was
// left, then remember the place (at most once a second while scrolling, and on close).
export function useSavedScroll(
  scrollRef: RefObject<HTMLElement | null>,
  positionKey: string,
  updatedAt: string,
  ready: boolean
): void {
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !ready) return undefined;
    const saved = loadGuidePosition(positionKey, updatedAt);
    if (saved?.kind === "scroll") {
      box.scrollTop = saved.ratio * Math.max(0, box.scrollHeight - box.clientHeight);
    }
    const save = () => {
      const room = box.scrollHeight - box.clientHeight;
      const ratio = room > 0 ? Math.min(1, Math.max(0, box.scrollTop / room)) : 0;
      saveGuidePosition(positionKey, updatedAt, { kind: "scroll", ratio });
    };
    let timer: number | null = null;
    const onScroll = () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        save();
      }, SAVE_EVERY_MS);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      if (timer !== null) window.clearTimeout(timer);
      save();
    };
  }, [scrollRef, positionKey, updatedAt, ready]);
}
