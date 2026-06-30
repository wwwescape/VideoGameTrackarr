import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";

interface VirtualListProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  estimateSize?: () => number;
  gap?: number;
}

// Single-column counterpart to VirtualGameGrid, for lists of variable-height sections
// (e.g. a game header plus its own small grid of cards) rather than uniform game cards in
// lanes. Same windowed-via-page-scroll approach — see VirtualGameGrid's comment for why.
function VirtualList<T>({ items, getKey, renderItem, estimateSize, gap = 16 }: VirtualListProps<T>) {
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
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: estimateSize ?? (() => 200),
    gap,
    overscan: 3,
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
              left: 0,
              width: "100%",
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

export default VirtualList;
