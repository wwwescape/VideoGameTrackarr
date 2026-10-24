import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GameCategory, LibraryItem } from "../api/types";
import { useClaimDiscoveredGame, useDeleteGame, useResyncGame } from "../hooks/useGames";
import { editFromDetail } from "../utils/navState";
import { hasPlayableRom } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import LinkToIgdbDialog from "./LinkToIgdbDialog";
import { ToolbarButton } from "./Page";
import PlayGameDialog from "./PlayGameDialog";

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
  // Drives the Play Game button — shown only when at least one owned copy has a ROM the
  // backend reports as playable in-browser.
  libraryItems?: LibraryItem[];
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
  libraryItems,
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
  const [playDialogOpen, setPlayDialogOpen] = useState(false);

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
      {hasPlayableRom(libraryItems) ? (
        <>
          <ToolbarButton
            primary
            icon={<SportsEsportsIcon />}
            label={t("games.actions.playGameButton")}
            onClick={() => setPlayDialogOpen(true)}
          />
          <PlayGameDialog
            open={playDialogOpen}
            gameName={gameName}
            libraryItems={libraryItems ?? []}
            onClose={() => setPlayDialogOpen(false)}
          />
        </>
      ) : null}
      {isAutoDiscovered ? (
        <ToolbarButton
          primary
          icon={<AddIcon />}
          label={hasParentGame ? t("games.actions.addAddonButton") : t("games.actions.addGameButton")}
          onClick={() => void handleClaimGame()}
          disabled={claimGameMutation.isPending}
        />
      ) : hasIgdbId ? (
        <>
          <ToolbarButton
            icon={<RefreshIcon />}
            label={hasParentGame ? t("games.actions.resyncAddonButton") : t("games.actions.resyncGameButton")}
            onClick={() => setResyncGameDialogOpen(true)}
          />
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
          <ToolbarButton
            icon={<EditIcon />}
            label={t("games.actions.editGameButton")}
            onClick={() => navigate(`/game/${gameIdentifier}/edit`, { state: editFromDetail })}
          />
          <ToolbarButton
            icon={<LinkIcon />}
            label={t("games.actions.linkToIgdbButton")}
            onClick={() => setLinkIgdbDialogOpen(true)}
          />
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
          {/* Remove sits at the far end of the toolbar, away from the everyday actions. */}
          <Box sx={{ flexGrow: 1 }} />
          <ToolbarButton
            danger
            icon={<DeleteOutlineIcon />}
            label={t("games.actions.removeGameButton")}
            onClick={() => setRemoveGameDialogOpen(true)}
          />
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
    </>
  );
};

export default GameActionButtons;
