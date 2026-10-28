import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { useResponsiveColumns } from "../hooks/useResponsiveColumns";
import { Section } from "./Detail";

// Same breakpoint -> column-count mapping the Games/Hardware grid uses (useResponsiveColumns,
// via VirtualGameGrid) — cards are sized as an even percentage-of-row-width share, not a fixed
// pixel width, so a "page" of the carousel always shows exactly `columns` full cards edge to
// edge, matching the grid pages look identical instead of ending mid-card.
const GAP_PX = 16; // matches sx `gap: 2` (MUI spacing unit = 8px)

function itemFlexBasis(columns: number): string {
  return `calc((100% - ${(columns - 1) * GAP_PX}px) / ${columns})`;
}

interface CardCarouselProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  getItemKey: (item: T) => string | number;
  title: string;
  // Omit when there's no dedicated full-page destination for this section (e.g. Release
  // Calendar) — the "View all" link beside the title only renders when this is set.
  viewAllHref?: string;
  // In-page anchor for the section.
  id?: string;
  // A fixed card width in px instead of the grid's per-breakpoint share of the row, as the
  // Overview's rows use.
  columnWidth?: number;
  // More links beside the title, before "View all" (Now Playing's Backlog link).
  actions?: ReactNode;
}

function CardCarousel<T>({
  items,
  renderItem,
  getItemKey,
  title,
  viewAllHref,
  id,
  columnWidth,
  actions,
}: CardCarouselProps<T>) {
  const { t } = useTranslation();
  const columns = useResponsiveColumns();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
    // items.length/columns are enough to trigger a recheck when the row's content or the
    // per-breakpoint column count changes — neither is referenced inside updateScrollState
    // itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, columns]);

  // With fixed-width cards the column count doesn't change on resize, but whether the row
  // overflows (and so whether > is enabled) does.
  useEffect(() => {
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, []);

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    // A full page now holds exactly `columns` complete cards (no partial one at the edge),
    // so scrolling by the container's own width moves cleanly from one full page to the next.
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <Section
      id={id}
      title={title}
      action={
        <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
          {actions}
          {viewAllHref ? (
            <Box
              component={Link}
              to={viewAllHref}
              sx={{ fontSize: 12.5, fontWeight: 600, color: "primary.main", textDecoration: "none", whiteSpace: "nowrap", mr: 0.5 }}
            >
              {t("common.viewAll")}
            </Box>
          ) : null}
          <IconButton size="small" onClick={() => scrollByPage(-1)} disabled={atStart} aria-label={t("common.scrollPrevious")}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => scrollByPage(1)} disabled={atEnd} aria-label={t("common.scrollNext")}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      <Box
        ref={scrollRef}
        onScroll={updateScrollState}
        sx={{
          display: "flex",
          gap: `${GAP_PX}px`,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {items.map((item) => (
          <Box
            key={getItemKey(item)}
            sx={{
              flex: `0 0 ${columnWidth ? `${columnWidth}px` : itemFlexBasis(columns)}`,
              // Without this, a flex item's automatic minimum size defaults to its content's
              // min-content width — a long, unwrapped (white-space: nowrap) game title can
              // exceed the fixed flex-basis above and silently blow the card up past its
              // intended width despite flex-grow: 0. minWidth: 0 (the standard fix for this
              // exact flexbox gotcha) forces the item to respect its fixed width regardless of
              // title length; overflow: hidden is the belt-and-suspenders backstop.
              minWidth: 0,
              overflow: "hidden",
              scrollSnapAlign: "start",
            }}
          >
            {renderItem(item)}
          </Box>
        ))}
      </Box>
    </Section>
  );
}

export default CardCarousel;
