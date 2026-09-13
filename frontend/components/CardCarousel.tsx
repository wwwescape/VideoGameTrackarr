import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

// Fixed per-breakpoint card width — a carousel item is sized by flex-basis, not MUI Grid's
// `size` prop (which only makes sense inside a wrapping grid).
const CARD_WIDTH = { xs: 140, sm: 160, md: 180, lg: 200 };
const GAP_PX = 16; // matches sx `gap: 2` (MUI spacing unit = 8px)
const MAX_VISIBLE_CARDS = 15;

// Caps the scroll container's own width so it never shows more than MAX_VISIBLE_CARDS at
// once, even on an ultrawide monitor — bounding the container, not just relying on cards
// happening not to fit.
function maxWidthForBreakpoint(cardWidth: number): string {
  return `calc(${MAX_VISIBLE_CARDS} * ${cardWidth}px + ${MAX_VISIBLE_CARDS - 1} * ${GAP_PX}px)`;
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
    // items.length is enough to trigger a recheck when the row's content changes — the
    // items themselves aren't referenced inside updateScrollState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
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
          maxWidth: {
            xs: maxWidthForBreakpoint(CARD_WIDTH.xs),
            sm: maxWidthForBreakpoint(CARD_WIDTH.sm),
            md: maxWidthForBreakpoint(CARD_WIDTH.md),
            lg: maxWidthForBreakpoint(CARD_WIDTH.lg),
          },
        }}
      >
        {items.map((item) => (
          <Box
            key={getItemKey(item)}
            sx={{
              flex: {
                xs: `0 0 ${CARD_WIDTH.xs}px`,
                sm: `0 0 ${CARD_WIDTH.sm}px`,
                md: `0 0 ${CARD_WIDTH.md}px`,
                lg: `0 0 ${CARD_WIDTH.lg}px`,
              },
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
