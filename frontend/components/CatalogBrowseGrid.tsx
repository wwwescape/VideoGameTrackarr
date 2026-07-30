import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { gameIdentifier } from "../utils/identifiers";
import GameCard from "./GameCard";
import VirtualGameGrid from "./VirtualGameGrid";

interface CatalogBrowseGridProps {
  kindLabel: string;
  name: string | undefined;
  games: GameSummary[] | undefined;
  isLoading: boolean;
}

const CatalogBrowseGrid = ({ kindLabel, name, games, isLoading }: CatalogBrowseGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          {kindLabel}
        </Typography>
        <Typography variant="h4" component="h1" gutterBottom>
          {name ?? t("common.loading")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("catalog.browseGrid.importedOnlyNotice")}
        </Typography>
      </Box>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          {t("catalog.browseGrid.emptyMessage", { kind: kindLabel.toLowerCase() })}
        </Paper>
      ) : (
        <VirtualGameGrid
          items={games}
          getKey={(game) => game.id}
          renderItem={(game) => (
            <GameCard game={game} context="list" contextFunction={() => navigate(`/game/${gameIdentifier(game)}`)} />
          )}
        />
      )}
    </>
  );
};

export default CatalogBrowseGrid;
