import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import FlatTile from "./FlatTile";

interface CatalogRefCardProps {
  name: string;
  gameCount: number;
  // Up to 4 (more are ignored): games you have first, then the earliest released.
  coverUrls: string[];
  onClick: () => void;
}

// Tile layout per number of covers: one fills the area, two sit side by side, three or four
// make a 2×2 grid (with three, the fourth square stays blank).
const GRID_BY_COUNT: Record<number, { columns: number; rows: number }> = {
  1: { columns: 1, rows: 1 },
  2: { columns: 2, rows: 1 },
  3: { columns: 2, rows: 2 },
  4: { columns: 2, rows: 2 },
};

// GameCard's counterpart for tiles that link out to a whole collection/franchise rather than
// a single game. The cover area is always there, even with no covers, so every card is the
// same height (VirtualGameGrid measures one card and assumes the rest match).
const CatalogRefCard = ({ name, gameCount, coverUrls, onClick }: CatalogRefCardProps) => {
  const { t } = useTranslation();
  const covers = coverUrls.slice(0, 4);
  const grid = GRID_BY_COUNT[covers.length];

  return (
    <FlatTile
      name={name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "3 / 4" }}
      lines={[t(gameCount === 1 ? "catalog.refCard.gameCountSingular" : "catalog.refCard.gameCountPlural", { count: gameCount })]}
      media={
        grid ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
              gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
              gap: "2px",
            }}
          >
            {covers.map((url) => (
              <Box
                key={url}
                component="img"
                src={resolveAssetUrl(url) ?? undefined}
                alt=""
                loading="lazy"
                sx={{ width: "100%", height: "100%", minHeight: 0, objectFit: "cover", display: "block" }}
              />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "vgt.text3",
              fontSize: 12,
            }}
          >
            {t("games.card.noCover")}
          </Box>
        )
      }
    />
  );
};

export default CatalogRefCard;
