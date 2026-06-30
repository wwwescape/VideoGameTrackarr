import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import RemoveIcon from "@mui/icons-material/Remove";
import Backdrop from "@mui/material/Backdrop";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { toast } from "react-toastify";
import type { GameCategory } from "../api/types";
import { useDeleteGame, useResyncGame } from "../hooks/useGames";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import LinkToIgdbDialog from "./LinkToIgdbDialog";

interface GameActionButtonsProps {
  gameId: number;
  gameIdentifier: string;
  gameName: string;
  gameCategory: GameCategory | null;
  // A game with a parent is removed via that parent's cascade, not its own page — see
  // GameDetails.tsx for why this is about the parent relationship, not the category.
  hasParentGame: boolean;
  hasIgdbId: boolean;
  // The id to resync against IGDB: the game's own id normally, or its parent's id when
  // viewing an addon — resyncing the parent already re-fetches all of its addons too, so
  // an addon's own "Resync" button just triggers that same cascade instead of resyncing
  // itself directly (which would also wrongly re-fetch "addons of this addon" from IGDB).
  resyncGameId: number;
  onGameRemoved: () => void;
}

const GameActionButtons = ({
  gameId,
  gameIdentifier,
  gameName,
  gameCategory,
  hasParentGame,
  hasIgdbId,
  resyncGameId,
  onGameRemoved,
}: GameActionButtonsProps) => {
  const navigate = useNavigate();
  const deleteGameMutation = useDeleteGame();
  const resyncGameMutation = useResyncGame(resyncGameId);

  const [resyncGameDialogOpen, setResyncGameDialogOpen] = useState(false);
  const [linkIgdbDialogOpen, setLinkIgdbDialogOpen] = useState(false);
  const [removeGameDialogOpen, setRemoveGameDialogOpen] = useState(false);

  const handleRemoveGame = async () => {
    try {
      await deleteGameMutation.mutateAsync(gameId);
      setRemoveGameDialogOpen(false);
      toast.success("Game removed from your library!", TOAST_OPTIONS);
      onGameRemoved();
    } catch (error) {
      console.error("Error removing game:", error);
      toast.error("Error removing game. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleResyncGame = async () => {
    try {
      await resyncGameMutation.mutateAsync();
      setResyncGameDialogOpen(false);
      toast.success(`${hasParentGame ? "Addon" : "Game"} resynced successfully!`, TOAST_OPTIONS);
    } catch (error) {
      console.error("Error resyncing game:", error);
      const message = isAxiosError(error) && error.response?.status === 503
        ? "IGDB isn't configured on this server."
        : `Error resyncing ${hasParentGame ? "addon" : "game"}. Please try again.`;
      toast.error(message, TOAST_OPTIONS);
    }
  };

  return (
    <>
      {resyncGameMutation.isPending && (
        <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.modal + 1 }} open={resyncGameMutation.isPending}>
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <Stack spacing={1.5}>
        {hasIgdbId ? (
          <>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={() => setResyncGameDialogOpen(true)}
              fullWidth
            >
              {hasParentGame ? "Resync Addon" : "Resync Game"}
            </Button>
            <ConfirmDialog
              open={resyncGameDialogOpen}
              title="Confirm Resync"
              description={
                hasParentGame
                  ? "Are you sure you want to resync this addon? This re-fetches the parent game's metadata from IGDB, which refreshes this addon along with the rest of its siblings."
                  : "Are you sure you want to resync this game? This re-fetches its metadata from IGDB."
              }
              confirmLabel="Resync"
              onClose={() => setResyncGameDialogOpen(false)}
              onConfirm={handleResyncGame}
            />
          </>
        ) : (
          <>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/game/${gameIdentifier}/edit`)}
              fullWidth
            >
              Edit Game
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LinkIcon />}
              onClick={() => setLinkIgdbDialogOpen(true)}
              fullWidth
            >
              Link to IGDB
            </Button>
            <LinkToIgdbDialog
              open={linkIgdbDialogOpen}
              gameId={gameId}
              gameName={gameName}
              gameCategory={gameCategory}
              onClose={() => setLinkIgdbDialogOpen(false)}
            />
          </>
        )}
        {!hasParentGame ? (
          <>
            <Button
              variant="contained"
              color="error"
              startIcon={<RemoveIcon />}
              onClick={() => setRemoveGameDialogOpen(true)}
              fullWidth
            >
              Remove Game
            </Button>
            <ConfirmDialog
              open={removeGameDialogOpen}
              title="Confirm Removal"
              description={`Are you sure you want to remove "${gameName}"? This permanently deletes it along with all of its addons (DLC, expansions, packs), collection/wishlist entries, progress, and notes. This cannot be undone.`}
              confirmLabel="Delete"
              confirmColor="error"
              onClose={() => setRemoveGameDialogOpen(false)}
              onConfirm={() => void handleRemoveGame()}
            />
          </>
        ) : null}
      </Stack>
    </>
  );
};

export default GameActionButtons;
