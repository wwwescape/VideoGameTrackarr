import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { ShelfCaseEntry } from "../api/types";
import { packRows, SHELF_GAP, type ShelfItem } from "../utils/shelfLayout";
import CaseSpine from "./CaseSpine";
import VirtualList from "./VirtualList";

const BOARD_HEIGHT = 12;
// Room above the tallest case for the hover lift.
const ROW_TOP_SPACE = 8;
const ROW_GAP = 20;

// The shelf's own width, kept up to date as the window or sidebar changes.
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function CaseButton<C extends ShelfCaseEntry>({
  item,
  onOpen,
}: {
  item: ShelfItem<C>;
  onOpen: (shelfCase: C) => void;
}) {
  const { t } = useTranslation();
  const label = t("games.shelf.caseLabel", { name: item.case.name, platform: item.platform.name });
  return (
    <Tooltip
      title={
        <>
          <Box sx={{ fontWeight: 600 }}>{item.case.name}</Box>
          <Box>{item.platform.name}</Box>
        </>
      }
      placement="top"
      disableInteractive
    >
      <ButtonBase
        aria-label={label}
        onClick={() => onOpen(item.case)}
        sx={{
          flexShrink: 0,
          borderRadius: "2px 2px 0 0",
          transition: "transform 120ms ease",
          "&:hover, &.Mui-focusVisible": { transform: "translateY(-6px)" },
          "&.Mui-focusVisible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      >
        <CaseSpine
          width={item.width}
          height={item.height}
          look={item.platform.case}
          fallbackLabel={item.platform.abbreviation ?? item.platform.name}
          title={item.case.name}
        />
      </ButtonBase>
    </Tooltip>
  );
}

interface GameShelfProps<C extends ShelfCaseEntry> {
  items: ShelfItem<C>[];
  onOpenCase: (shelfCase: C) => void;
}

// The shelf: cases packed into rows as wide as the page, each row on a wooden board, platforms
// mixed in the requested sort. Only the rows near the screen are rendered.
function GameShelf<C extends ShelfCaseEntry>({ items, onOpenCase }: GameShelfProps<C>) {
  const theme = useTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const rows = useMemo(
    () => (width > 0 ? packRows(items, width - 16, SHELF_GAP) : []),
    [items, width]
  );
  const board =
    theme.palette.mode === "dark"
      ? "linear-gradient(180deg, #7a4f26 0%, #5e3b1b 55%, #4a2e15 100%)"
      : "linear-gradient(180deg, #b07a45 0%, #94622f 55%, #7a4f24 100%)";

  return (
    <Box ref={ref} sx={{ width: "100%" }}>
      <VirtualList
        items={rows}
        getKey={(row) => row.key}
        gap={ROW_GAP}
        estimateSize={() => 300}
        renderItem={(row) => (
          <Box role="list" sx={{ pt: `${ROW_TOP_SPACE}px` }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-end",
                gap: `${SHELF_GAP}px`,
                px: 1,
                height: row.height,
              }}
            >
              {row.items.map((item) => (
                <Box key={item.key} role="listitem" sx={{ display: "flex" }}>
                  <CaseButton item={item} onOpen={onOpenCase} />
                </Box>
              ))}
            </Box>
            <Box
              aria-hidden
              sx={{
                height: BOARD_HEIGHT,
                background: board,
                borderRadius: "0 0 4px 4px",
                boxShadow: "0 6px 10px rgba(0,0,0,0.3)",
              }}
            />
          </Box>
        )}
      />
    </Box>
  );
}

// Memoized: the page re-renders for its menus, which needn't redraw every case.
export default memo(GameShelf) as typeof GameShelf;
