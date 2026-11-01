import { useMemo } from "react";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import type { ToysToLifeLine } from "../api/types";
import { useToysToLifeLines } from "../hooks/useToysToLife";
import { LINE_LOGOS } from "../utils/toysToLife";
import CatalogIndexGrid, { type CatalogIndexColumn } from "./CatalogIndexGrid";
import FlatTile from "./FlatTile";

interface LineEntry extends ToysToLifeLine {
  id: number;
}

// A line's card: its logo on a dark well (the logos are made for dark backgrounds), in light
// and dark mode, with its pack and collection counts.
const LineCard = ({ line, onClick }: { line: LineEntry; onClick: () => void }) => {
  const { t } = useTranslation();
  const logo = LINE_LOGOS[line.slug];
  return (
    <FlatTile
      name={line.name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "16 / 9", bgcolor: "#101318" }}
      lines={[
        t("toysToLife.packCount", { count: line.packCount }),
        t("toysToLife.collectionSummary", { owned: line.ownedCount, wishlist: line.wishlistCount }),
      ]}
      media={
        logo ? (
          <Box
            component="img"
            src={logo}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", p: 2, boxSizing: "border-box" }}
          />
        ) : (
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontWeight: 650, p: 2 }}>
            {line.name}
          </Box>
        )
      }
    />
  );
};

// Toys to Life: a card per line (LEGO Dimensions, ...), each opening its packs.
const ToysToLifePage = () => {
  const { t } = useTranslation();
  const { data: lines, isLoading } = useToysToLifeLines();
  // CatalogIndexGrid keys entries by a numeric id; lines are known by their slug.
  const entries = useMemo(() => lines?.map((line, index): LineEntry => ({ ...line, id: index })), [lines]);

  const tableColumns: CatalogIndexColumn<LineEntry>[] = [
    { key: "packs", label: t("toysToLife.columnPacks"), render: (line) => line.packCount, sortValue: (line) => line.packCount },
    { key: "owned", label: t("toysToLife.columnOwned"), render: (line) => line.ownedCount, sortValue: (line) => line.ownedCount },
    {
      key: "wishlisted",
      label: t("toysToLife.columnWishlisted"),
      render: (line) => line.wishlistCount,
      sortValue: (line) => line.wishlistCount,
    },
  ];

  return (
    <CatalogIndexGrid
      stateKey="toysToLife"
      emptyMessage={t("toysToLife.linesPage.emptyMessage")}
      countKey="toysToLife.linesPage.count"
      searchLabel={t("toysToLife.linesPage.searchLabel")}
      searchPlaceholder={t("toysToLife.linesPage.searchPlaceholder")}
      entries={entries}
      isLoading={isLoading}
      getKey={(line) => line.slug}
      getHref={(line) => `/toys-to-life/${line.slug}`}
      renderCard={(line, onClick) => <LineCard line={line} onClick={onClick} />}
      tableColumns={tableColumns}
    />
  );
};

export default ToysToLifePage;
