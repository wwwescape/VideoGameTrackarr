import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { searchIgdb } from "../api/igdb";
import type { GameCategory, IgdbSearchResult } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames, useLinkGameToIgdb, useLinkGameToIgdbViaParent, useMergeGameIntoIgdb } from "../hooks/useGames";
import { useIgdbSearch } from "../hooks/useIgdbSearch";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import GameCard from "./GameCard";
import MessageDialog from "./MessageDialog";

const MIN_SEARCH_LENGTH = 4;

// Mirrors ManualGameForm.tsx's CATEGORY_OPTIONS split: independently ownable/playable
// games vs. content that only makes sense bolted onto an existing copy.
const GAME_TYPE_CATEGORIES: GameCategory[] = [
  "main_game",
  "standalone_expansion",
  "expanded_game",
  "bundle",
  "remaster",
];
const ADDON_TYPE_CATEGORIES: GameCategory[] = ["dlc_addon", "expansion", "pack"];

interface LinkToIgdbDialogProps {
  open: boolean;
  gameId: number;
  gameName: string;
  gameCategory: GameCategory | null;
  onClose: () => void;
}

interface ParentNeeded {
  addonIgdbId: number;
  parentIgdbId: number;
  parentName: string;
}

interface DuplicateFound {
  igdbId: number;
  name: string;
}

const LinkToIgdbDialog = ({ open, gameId, gameName, gameCategory, onClose }: LinkToIgdbDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(gameName);
  const [manualIgdbId, setManualIgdbId] = useState("");
  const [isResolvingManualId, setIsResolvingManualId] = useState(false);
  const [parentNeeded, setParentNeeded] = useState<ParentNeeded | null>(null);
  const [duplicateFound, setDuplicateFound] = useState<DuplicateFound | null>(null);
  const [cannotBeAddedOpen, setCannotBeAddedOpen] = useState(false);
  const linkGameToIgdb = useLinkGameToIgdb(gameId);
  const linkViaParent = useLinkGameToIgdbViaParent(gameId);
  const mergeIntoIgdb = useMergeGameIntoIgdb(gameId);
  const { data: localGames } = useGames();

  const isLinkingAddon = gameCategory !== null && ADDON_TYPE_CATEGORIES.includes(gameCategory);
  const allowedCategories = isLinkingAddon ? ADDON_TYPE_CATEGORIES : GAME_TYPE_CATEGORIES;

  useEffect(() => {
    if (open) {
      setQuery(gameName);
      setManualIgdbId("");
      setParentNeeded(null);
      setDuplicateFound(null);
      setCannotBeAddedOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const debouncedQuery = useDebouncedValue(query.trim(), 500);
  const isSearchActive = debouncedQuery.length >= MIN_SEARCH_LENGTH;
  const { data: searchResults, isFetching, error: searchError } = useIgdbSearch(
    isSearchActive ? debouncedQuery : "",
    isLinkingAddon ? "addon" : "game"
  );
  // The "game" scope search still includes remake (IGDB's own browsable-types query), which
  // isn't in the 5-category allowlist for linking a custom game — filter it out here too.
  const suggestions = (searchResults ?? []).filter(
    (result) => result.category !== null && allowedCategories.includes(result.category)
  );
  const igdbNotConfigured = isAxiosError(searchError) && searchError.response?.status === 503;
  const isPending = linkGameToIgdb.isPending || linkViaParent.isPending || mergeIntoIgdb.isPending || isResolvingManualId;

  const handleLinkError = (error: unknown) => {
    console.error("Error linking game to IGDB:", error);
    toast.error(t("igdb.linkError"), TOAST_OPTIONS);
  };

  const handleLink = async (igdbId: number, name: string) => {
    try {
      await linkGameToIgdb.mutateAsync(igdbId);
      toast.success(t("igdb.linkedSuccess"), TOAST_OPTIONS);
      onClose();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setDuplicateFound({ igdbId, name });
        return;
      }
      handleLinkError(error);
    }
  };

  // Shared by both suggestion clicks and the manual-ID field: routes a resolved IGDB result
  // to the right outcome based on its category — link directly, check for/offer to import
  // its parent, or refuse.
  const resolveAndLink = (result: IgdbSearchResult) => {
    if (result.category !== null && GAME_TYPE_CATEGORIES.includes(result.category)) {
      void handleLink(result.igdbId, result.name);
      return;
    }
    if (result.category !== null && ADDON_TYPE_CATEGORIES.includes(result.category)) {
      if (!result.parentGame) {
        setCannotBeAddedOpen(true);
        return;
      }
      const parentExistsLocally = localGames?.some((game) => game.igdbId === result.parentGame!.igdbId);
      if (parentExistsLocally) {
        void handleLink(result.igdbId, result.name);
      } else {
        setParentNeeded({
          addonIgdbId: result.igdbId,
          parentIgdbId: result.parentGame.igdbId,
          parentName: result.parentGame.name,
        });
      }
      return;
    }
    setCannotBeAddedOpen(true);
  };

  const handleManualLink = async () => {
    const igdbId = Number(manualIgdbId);
    if (!Number.isInteger(igdbId) || igdbId <= 0) {
      toast.error(t("igdb.invalidIdError"), TOAST_OPTIONS);
      return;
    }
    setIsResolvingManualId(true);
    try {
      const results = await searchIgdb(`igdb:${igdbId}`);
      if (results.length === 0) {
        toast.error(t("igdb.idNotFoundError", { id: igdbId }), TOAST_OPTIONS);
        return;
      }
      resolveAndLink(results[0]);
    } catch (error) {
      console.error("Error looking up IGDB id:", error);
      toast.error(t("igdb.idLookupError"), TOAST_OPTIONS);
    } finally {
      setIsResolvingManualId(false);
    }
  };

  const handleProceedWithParent = async () => {
    if (!parentNeeded) return;
    try {
      const game = await linkViaParent.mutateAsync(parentNeeded.addonIgdbId);
      toast.success(t("igdb.parentAddedSuccess"), TOAST_OPTIONS);
      setParentNeeded(null);
      onClose();
      navigate(`/addon/${gameIdentifier(game)}`);
    } catch (error) {
      console.error("Error adding parent game:", error);
      toast.error(t("igdb.addParentError"), TOAST_OPTIONS);
    }
  };

  const handleConfirmMerge = async () => {
    if (!duplicateFound) return;
    try {
      const game = await mergeIntoIgdb.mutateAsync(duplicateFound.igdbId);
      toast.success(t("igdb.mergeSuccess"), TOAST_OPTIONS);
      setDuplicateFound(null);
      onClose();
      navigate(`/game/${gameIdentifier(game)}`);
    } catch (error) {
      console.error("Error merging duplicate game:", error);
      const message =
        isAxiosError(error) && error.response?.status === 409
          ? t("igdb.mergeProgressConflictError")
          : t("igdb.mergeError");
      toast.error(message, TOAST_OPTIONS);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{t("igdb.dialogTitle")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TextField
            label={t("igdb.searchLabel")}
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={isPending}
            sx={{ flexShrink: 0 }}
          />

          {/* Only this region scrolls — the search field above and the manual id field/
              actions below stay in view regardless of how many suggestions come back.
              minHeight: 0 is load-bearing: flex items default to a content-based min-height,
              which would otherwise stop this from ever shrinking smaller than its content
              (i.e. exactly what shoved the id field/actions out of a shorter viewport). */}
          <Box sx={{ flexGrow: 1, flexShrink: 1, minHeight: 0, maxHeight: 420, overflowY: "auto", my: 2 }}>
            {igdbNotConfigured ? (
              <Typography color="text.secondary">{t("igdb.notConfigured")}</Typography>
            ) : isFetching ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : !isSearchActive ? (
              <Typography color="text.secondary">{t("igdb.keepTyping")}</Typography>
            ) : suggestions.length === 0 ? (
              <Typography color="text.secondary">{t("igdb.noMatches")}</Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.5 }}>
                {suggestions.map((result) => (
                  <GameCard
                    key={result.igdbId}
                    game={result}
                    context="add"
                    contextFunction={() => resolveAndLink(result)}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Divider sx={{ flexShrink: 0 }} />

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", flexShrink: 0, mt: 2 }}>
            <TextField
              label={t("igdb.idFieldLabel")}
              value={manualIgdbId}
              onChange={(event) => setManualIgdbId(event.target.value)}
              disabled={isPending}
              helperText={t("igdb.idFieldHelperText")}
            />
            <Button
              variant="outlined"
              onClick={() => void handleManualLink()}
              disabled={isPending || !manualIgdbId.trim()}
              sx={{ mt: 1 }}
            >
              {t("igdb.linkButton")}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isPending}>
            {t("common.cancel")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={parentNeeded !== null}
        title={t("igdb.parentNeededTitle")}
        description={
          parentNeeded
            ? t("igdb.parentNeededDescription", { name: parentNeeded.parentName, id: parentNeeded.parentIgdbId })
            : ""
        }
        confirmLabel={t("igdb.proceedButton")}
        onClose={() => setParentNeeded(null)}
        onConfirm={() => void handleProceedWithParent()}
      />
      <ConfirmDialog
        open={duplicateFound !== null}
        title={t("igdb.duplicateFoundTitle")}
        description={duplicateFound ? t("igdb.duplicateFoundDescription", { name: duplicateFound.name }) : ""}
        confirmLabel={t("igdb.mergeButton")}
        onClose={() => setDuplicateFound(null)}
        onConfirm={() => void handleConfirmMerge()}
      />
      <MessageDialog
        open={cannotBeAddedOpen}
        title={t("igdb.cannotLinkTitle")}
        message={t("igdb.cannotLinkMessage")}
        onClose={() => setCannotBeAddedOpen(false)}
      />
    </>
  );
};

export default LinkToIgdbDialog;
