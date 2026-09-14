import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import RemoveIcon from "@mui/icons-material/Remove";
import Backdrop from "@mui/material/Backdrop";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GameCategory } from "../api/types";
import { useClaimDiscoveredGame, useDeleteGame, useResyncGame } from "../hooks/useGames";
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
  // True for a game/addon that only exists locally because a Collection/Series "what's
  // missing" resync discovered it — nothing to resync/remove from a personal library that
  // was never asked for, so this replaces the whole Resync/Remove/Edit/Link block below with
  // a single claim action.
  isAutoDiscovered: boolean;
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
  isAutoDiscovered,
  onGameRemoved,
}: GameActionButtonsProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteGameMutation = useDeleteGame();
  const resyncGameMutation = useResyncGame(resyncGameId);
  const claimGameMutation = useClaimDiscoveredGame(gameId);

  const [resyncGameDialogOpen, setResyncGameDialogOpen] = useState(false);
  const [linkIgdbDialogOpen, setLinkIgdbDialogOpen] = useState(false);
  const [removeGameDialogOpen, setRemoveGameDialogOpen] = useState(false);

  const handleRemoveGame = async () => {
    try {
      await deleteGameMutation.mutateAsync(gameId);
      setRemoveGameDialogOpen(false);
      toast.success(t("games.actions.removeSuccessToast"), TOAST_OPTIONS);
      onGameRemoved();
    } catch (error) {
      console.error("Error removing game:", error);
      toast.error(t("games.actions.removeErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleClaimGame = async () => {
    try {
      await claimGameMutation.mutateAsync();
      toast.success(
        hasParentGame ? t("games.actions.claimAddonSuccessToast") : t("games.actions.claimGameSuccessToast"),
        TOAST_OPTIONS
      );
    } catch (error) {
      console.error("Error adding game:", error);
      toast.error(
        hasParentGame ? t("games.actions.claimAddonErrorToast") : t("games.actions.claimGameErrorToast"),
        TOAST_OPTIONS
      );
    }
  };

  const handleResyncGame = async () => {
    try {
      await resyncGameMutation.mutateAsync();
      setResyncGameDialogOpen(false);
      toast.success(
        hasParentGame ? t("games.actions.resyncAddonSuccessToast") : t("games.actions.resyncGameSuccessToast"),
        TOAST_OPTIONS
      );
    } catch (error) {
      console.error("Error resyncing game:", error);
      const message = isAxiosError(error) && error.response?.status === 503
        ? t("games.actions.igdbNotConfiguredError")
        : hasParentGame
          ? t("games.actions.resyncAddonErrorToast")
          : t("games.actions.resyncGameErrorToast");
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
        {isAutoDiscovered ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => void handleClaimGame()}
            disabled={claimGameMutation.isPending}
            fullWidth
          >
            {hasParentGame ? t("games.actions.addAddonButton") : t("games.actions.addGameButton")}
          </Button>
        ) : hasIgdbId ? (
          <>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={() => setResyncGameDialogOpen(true)}
              fullWidth
            >
              {hasParentGame ? t("games.actions.resyncAddonButton") : t("games.actions.resyncGameButton")}
            </Button>
            <ConfirmDialog
              open={resyncGameDialogOpen}
              title={t("games.actions.resyncConfirmTitle")}
              description={
                hasParentGame
                  ? t("games.actions.resyncAddonConfirmDescription")
                  : t("games.actions.resyncGameConfirmDescription")
              }
              confirmLabel={t("games.actions.resyncConfirmLabel")}
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
              {t("games.actions.editGameButton")}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LinkIcon />}
              onClick={() => setLinkIgdbDialogOpen(true)}
              fullWidth
            >
              {t("games.actions.linkToIgdbButton")}
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
        {!hasParentGame && !isAutoDiscovered ? (
          <>
            <Button
              variant="contained"
              color="error"
              startIcon={<RemoveIcon />}
              onClick={() => setRemoveGameDialogOpen(true)}
              fullWidth
            >
              {t("games.actions.removeGameButton")}
            </Button>
            <ConfirmDialog
              open={removeGameDialogOpen}
              title={t("games.actions.removeConfirmTitle")}
              description={t("games.actions.removeConfirmDescription", { name: gameName })}
              confirmLabel={t("common.delete")}
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
