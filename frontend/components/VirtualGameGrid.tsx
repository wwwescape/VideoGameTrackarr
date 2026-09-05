import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";
import { useLocation, useNavigationType } from "react-router-dom";
import { useResponsiveColumns } from "../hooks/useResponsiveColumns";

// Rough card-row-height guess per column count (narrower columns => taller cover-art
// aspect ratio relative to text below it). Only affects the very first paint / how many
// rows the initial overscan covers — the virtualizer self-corrects via measureElement
// once real cards have mounted, so this doesn't need to be exact.
const ESTIMATED_ROW_HEIGHT_BY_COLUMNS: Record<number, number> = {
  2: 320,
  3: 270,
  4: 230,
  6: 180,
};

const GRID_GAP_PX = 16;
const SAVE_THROTTLE_MS = 100;

// Session-lifetime, in-memory — the topmost-visible item's own key (e.g. a game id), not a
// pixel offset, per location (`pathname + search`). A key survives column-count differences and
// doesn't depend on the row-height estimate being accurate at save time, unlike a raw scrollY
// would. Scoped by location only (not per grid instance) — fine today since no single route
// renders two VirtualGameGrids at once.
const visibleItemKeyByLocation = new Map<string, number>();

function locationKey(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

interface VirtualGameGridProps<T> {
  items: T[];
  getKey: (item: T) => number;
  renderItem: (item: T) => ReactNode;
  // Overrides the cover-art-card height guess below — for grids of shorter, imageless
  // tiles (e.g. catalog ref cards) where that estimate would be way too tall.
  estimateRowHeight?: (columns: number) => number;
}

// A responsive, windowed grid for the game card layout. Renders only the rows near the
// viewport (via the page's own scroll, not an inner scroll pane — see useWindowVirtualizer)
// regardless of how many games are in the library, so a collection of a few thousand games
// costs the same DOM size as one of a few dozen.
function VirtualGameGrid<T>({ items, getKey, renderItem, estimateRowHeight }: VirtualGameGridProps<T>) {
  const columns = useResponsiveColumns();
  const containerRef = useRef<HTMLDivElement>(null);
  // null (not 0) while not yet measured — 0 is a legitimate real value (a grid with nothing
  // above it), so the POP-restore effect below needs to tell "not measured yet" apart from
  // "measured, and it happens to be zero" before it can safely call scrollToIndex.
  const [scrollMargin, setScrollMargin] = useState<number | null>(null);
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const currentLocationKey = locationKey(pathname, search);

  // Self-calibrating row-height estimate: starts from the guessed constant below (cheap
  // first-paint fallback), then gets overwritten with the real measured height of the first
  // row that actually mounts — GameCard/HardwareCard rows are near-uniform within one grid
  // (fixed cover aspect-ratio, single-line ellipsized title, reserved-but-hidden badge/chip
  // slots specifically to keep row height constant), so one real measurement is an accurate
  // stand-in for the rest. Fixes fast-scroll gaps: without this, a fast fling jumps into
  // never-rendered territory where the index-at-offset math has nothing but the guess to go on,
  // and any per-row error compounds over hundreds of skipped rows. Scoped per mount, not
  // persisted across navigations — different call sites render different card shapes (compare
  // GameCard vs the shorter CatalogRefCard vs HardwareCard) at the same column count, so a
  // cross-mount cache keyed only by column count would let one page's calibration corrupt
  // another's.
  //
  // Real state, not a ref: the POP-restore effect below needs to *wait* for this (and for
  // scrollMargin) to be ready before calling scrollToIndex — a ref write doesn't retrigger that
  // effect, and empirically the effect can otherwise run while both are still at their unready
  // defaults (confirmed via logging: scrollToIndex firing with scrollMargin still 0 and no
  // calibration yet), landing many rows off from the intended target.
  const [calibratedHeight, setCalibratedHeight] = useState<number | null>(null);
  useEffect(() => {
    setCalibratedHeight(null); // column width changed => card height changed too
  }, [columns]);

  // Recomputes scrollMargin (this grid's absolute document offset) whenever anything on the
  // page resizes, not just the viewport — a plain window "resize" listener missed the case
  // where content above the grid (toolbar, filter chips, subnav) finishes loading and shifts
  // height after the one-time initial measurement, which left the whole grid rendered at a
  // stale vertical offset.
  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      if (containerRef.current) {
        setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY);
      }
    };
    updateScrollMargin();
    const observer = new ResizeObserver(updateScrollMargin);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [columns]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () =>
      calibratedHeight ?? estimateRowHeight?.(columns) ?? ESTIMATED_ROW_HEIGHT_BY_COLUMNS[columns] ?? 260,
    lanes: columns,
    gap: GRID_GAP_PX,
    overscan: 4,
    scrollMargin: scrollMargin ?? 0,
    getItemKey: (index) => getKey(items[index]),
  });

  // Wraps the library's own measureElement (still needed for its per-row ResizeObserver
  // bookkeeping) to also capture the first real measurement into calibratedHeight above.
  // Deliberately does NOT force a virtualizer.measure() recompute — that clears the *entire*
  // size cache (not just one item), which empirically fought scrollToIndex's own multi-frame
  // self-correction below (a POP-navigation restore landed many rows off when a calibration
  // measure() fired mid-reconciliation). Not forcing it is still enough for the fast-scroll
  // fix: any item that hasn't been individually measured yet is already estimated *live* via
  // estimateSize() on every range calculation, so once state updates, every subsequent
  // not-yet-rendered row picks up the corrected value on its own — only already-cached
  // measurements from before calibration keep their old (rough-guess-based) values, and those
  // get corrected individually as they're revisited, same as any ordinary resize. useCallback
  // keeps this stable across renders — the same way virtualizer.measureElement itself is a
  // stable instance-bound method — so React doesn't tear down and reattach every row's ref on
  // every render.
  const measureElementRef = useCallback(
    (node: Element | null) => {
      virtualizer.measureElement(node);
      if (node && calibratedHeight === null) {
        const measured = node.getBoundingClientRect().height;
        if (measured > 0) setCalibratedHeight(measured);
      }
    },
    [virtualizer, calibratedHeight]
  );

  // Restores scroll on a POP navigation by resolving the saved item key to its current index
  // and asking the virtualizer to scroll to it — self-correcting across frames even before
  // neighboring rows are individually measured (confirmed against virtual-core's source:
  // scrollToIndex is not a raw pixel jump, unlike useScrollResetOnNavigate's generic fallback,
  // which this refines once real data is available). Runs at most once per mount, and gates
  // hasSavingStartedRef so the save-on-scroll effect below doesn't clobber the saved key with
  // "whatever's on screen at scrollY 0" before this has had a chance to run.
  //
  // Explicitly waits for both scrollMargin and calibratedHeight to be ready (not just items) —
  // confirmed via logging that without this, the effect can run while both are still at their
  // unready defaults (scrollMargin 0, calibratedHeight null), computing scrollToIndex's target
  // offset from a layout that hasn't actually been measured yet and landing many rows off.
  const hasAttemptedRestoreRef = useRef(false);
  const hasSavingStartedRef = useRef(false);
  useEffect(() => {
    if (hasAttemptedRestoreRef.current) return;
    if (navigationType !== "POP") {
      hasAttemptedRestoreRef.current = true;
      hasSavingStartedRef.current = true;
      return;
    }
    if (items.length === 0 || scrollMargin === null || calibratedHeight === null) return;
    hasAttemptedRestoreRef.current = true;
    const savedKey = visibleItemKeyByLocation.get(currentLocationKey);
    if (savedKey !== undefined) {
      const index = items.findIndex((item) => getKey(item) === savedKey);
      if (index >= 0) virtualizer.scrollToIndex(index, { align: "start" });
    }
    hasSavingStartedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, navigationType, scrollMargin, calibratedHeight]);

  const lastSaveAtRef = useRef(0);
  useEffect(() => {
    if (scrollMargin === null) return;
    const handleScroll = () => {
      if (!hasSavingStartedRef.current) return;
      const now = Date.now();
      if (now - lastSaveAtRef.current < SAVE_THROTTLE_MS) return;
      lastSaveAtRef.current = now;
      // getVirtualItems()[0] would be the first *rendered* item, which includes rows pulled in
      // by overscan above the actual viewport — find the first one that's truly at or below the
      // top of the visible area instead, so a later scrollToIndex({align: "start"}) lands back
      // at the same visual position rather than a few overscanned rows earlier. Compared
      // directly against window.scrollY with no scrollMargin adjustment: virtualItem.start is
      // already page-absolute (scrollMargin is baked in, same reason the render below has to
      // subtract it back out to get a container-relative transform), so scrollMargin has no
      // place in this comparison — subtracting it here once mixed page-absolute and
      // container-relative coordinates, silently offsetting every saved position by roughly
      // scrollMargin's worth of rows.
      const scrollTop = window.scrollY;
      const visibleItem = virtualizer.getVirtualItems().find((virtualItem) => virtualItem.start >= scrollTop - 1);
      if (!visibleItem) return;
      const item = items[visibleItem.index];
      if (item) {
        visibleItemKeyByLocation.set(currentLocationKey, getKey(item));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, scrollMargin]);

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%", height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        return (
          <Box
            key={virtualItem.key}
            ref={measureElementRef}
            data-index={virtualItem.index}
            sx={{
              position: "absolute",
              top: 0,
              left: `${(virtualItem.lane / columns) * 100}%`,
              width: `${100 / columns}%`,
              boxSizing: "border-box",
              px: `${GRID_GAP_PX / 2}px`,
              transform: `translateY(${virtualItem.start - (scrollMargin ?? 0)}px)`,
            }}
          >
            {renderItem(item)}
          </Box>
        );
      })}
    </Box>
  );
}

export default VirtualGameGrid;
