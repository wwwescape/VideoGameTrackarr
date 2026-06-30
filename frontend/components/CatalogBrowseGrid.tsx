import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
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
  const navigate = useNavigate();

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          {kindLabel}
        </Typography>
        <Typography variant="h4" component="h1" gutterBottom>
          {name ?? "Loading..."}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Only games you&apos;ve already imported show up here.
        </Typography>
      </Box>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>No locally-known games in this {kindLabel.toLowerCase()} yet.</Paper>
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
