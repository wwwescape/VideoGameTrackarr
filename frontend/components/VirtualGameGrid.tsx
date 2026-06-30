import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";
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
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      if (containerRef.current) {
        setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY);
      }
    };
    updateScrollMargin();
    window.addEventListener("resize", updateScrollMargin);
    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [columns]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateRowHeight?.(columns) ?? ESTIMATED_ROW_HEIGHT_BY_COLUMNS[columns] ?? 260,
    lanes: columns,
    gap: GRID_GAP_PX,
    overscan: 4,
    scrollMargin,
    getItemKey: (index) => getKey(items[index]),
  });

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%", height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        return (
          <Box
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            sx={{
              position: "absolute",
              top: 0,
              left: `${(virtualItem.lane / columns) * 100}%`,
              width: `${100 / columns}%`,
              boxSizing: "border-box",
              px: `${GRID_GAP_PX / 2}px`,
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
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
