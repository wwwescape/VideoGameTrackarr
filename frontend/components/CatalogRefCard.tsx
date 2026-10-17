import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";

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
  const theme = useTheme();
  const covers = coverUrls.slice(0, 4);
  const grid = GRID_BY_COUNT[covers.length];

  return (
    <Card
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: theme.shadows[6] },
      }}
    >
      <CardActionArea onClick={onClick}>
        <Box
          sx={{
            position: "relative",
            aspectRatio: "3 / 4",
            overflow: "hidden",
            bgcolor: "action.hover",
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          {grid ? (
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
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t("games.card.noCover")}
              </Typography>
            </Box>
          )}
        </Box>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Typography
            variant="subtitle2"
            component="div"
            title={name}
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <strong>{name}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {t(gameCount === 1 ? "catalog.refCard.gameCountSingular" : "catalog.refCard.gameCountPlural", {
              count: gameCount,
            })}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default CatalogRefCard;
