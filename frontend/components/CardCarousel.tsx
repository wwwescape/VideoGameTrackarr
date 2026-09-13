import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useResponsiveColumns } from "../hooks/useResponsiveColumns";

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
  // Calendar) — the chevron-link next to the title only renders when this is set.
  viewAllHref?: string;
}

function CardCarousel<T>({
  items,
  renderItem,
  getItemKey,
  title,
  viewAllHref,
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

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    // A full page now holds exactly `columns` complete cards (no partial one at the edge),
    // so scrolling by the container's own width moves cleanly from one full page to the next.
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 1.5 }}>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {viewAllHref ? (
          <IconButton
            component={Link}
            to={viewAllHref}
            size="small"
            aria-label={t("common.viewAll")}
            sx={{ color: "text.secondary" }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          size="small"
          onClick={() => scrollByPage(-1)}
          disabled={atStart}
          aria-label={t("common.scrollPrevious")}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => scrollByPage(1)}
          disabled={atEnd}
          aria-label={t("common.scrollNext")}
        >
          <ChevronRightIcon />
        </IconButton>
      </Stack>
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
              flex: `0 0 ${itemFlexBasis(columns)}`,
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
    </Box>
  );
}

export default CardCarousel;
