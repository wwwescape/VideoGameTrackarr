import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";

// Space between card columns, in every card grid.
export const CARD_GRID_GAP_PX = 16;
// Below this frame width there's no room to fit cards by size, so the card size picks a column
// count instead (phoneColumns).
const PHONE_MAX_WIDTH_PX = 600;
// Marks the page's content frame (Page sets it). Card grids count their columns from its width,
// not their own, so every list shows the same number of cards per row at a given card size and
// window size — whether or not it has an A–Z rail beside it or a scrollbar showing.
export const CARD_FRAME_ATTRIBUTE = "data-card-frame";

// On phones, Options → Card size chooses 1, 2 or 3 columns: the smallest sizes 3, the default
// (170) 2, the largest sizes 1. Shared by every card grid with the slider, so they all agree.
export function phoneColumns(cardSize: number): number {
  if (cardSize < 160) return 3;
  if (cardSize <= 230) return 2;
  return 1;
}

export const phoneGridColumns = (cardSize: number) => `repeat(${phoneColumns(cardSize)}, minmax(0, 1fr))`;

export function cardColumnsForWidth(width: number, cardSize: number): number {
  if (width < PHONE_MAX_WIDTH_PX) return phoneColumns(cardSize);
  return Math.max(1, Math.floor((width + CARD_GRID_GAP_PX) / (cardSize + CARD_GRID_GAP_PX)));
}

// The width card columns are counted from: the page frame's content box, plus the vertical
// scrollbar's width (so a short list without one doesn't gain a column over a long list with
// one). Falls back to the grid's own width outside a Page (public pages).
function referenceWidth(node: HTMLElement): number {
  const frame = node.closest<HTMLElement>(`[${CARD_FRAME_ATTRIBUTE}]`);
  if (!frame) return node.getBoundingClientRect().width;
  const style = getComputedStyle(frame);
  const content =
    frame.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  return content + scrollbar;
}

// Columns for a card grid at this card size; null until the grid has mounted and been measured.
// Attach the ref to the grid's own element.
export function useCardColumns<T extends HTMLElement = HTMLDivElement>(cardSize: number | undefined) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  const enabled = cardSize !== undefined;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    const update = () => setWidth(referenceWidth(node));
    update();
    // Missing outside a real browser (jsdom): measured once, then.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    const frame = node.closest(`[${CARD_FRAME_ATTRIBUTE}]`);
    if (frame) observer.observe(frame);
    return () => observer.disconnect();
  }, [enabled]);
  const columns = cardSize !== undefined && width ? cardColumnsForWidth(width, cardSize) : null;
  return { ref, columns };
}

// A plain (not windowed) card grid sized by the Options card size, for the shorter lists
// (On Sale, Missing Add-ons, Events). Same column count as the windowed grids.
export function CardGrid({ cardSize, children }: { cardSize: number; children: ReactNode }) {
  const { ref, columns } = useCardColumns(cardSize);
  return (
    <Box
      ref={ref}
      sx={{
        display: "grid",
        gridTemplateColumns: columns
          ? `repeat(${columns}, minmax(0, 1fr))`
          : { xs: phoneGridColumns(cardSize), sm: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` },
        gap: `18px ${CARD_GRID_GAP_PX}px`,
      }}
    >
      {children}
    </Box>
  );
}
