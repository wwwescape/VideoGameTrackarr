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
import { toast } from "react-toastify";
import { searchIgdb } from "../api/igdb";
import type { GameCategory, IgdbSearchResult } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames, useLinkGameToIgdb, useLinkGameToIgdbViaParent } from "../hooks/useGames";
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

const LinkToIgdbDialog = ({ open, gameId, gameName, gameCategory, onClose }: LinkToIgdbDialogProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState(gameName);
  const [manualIgdbId, setManualIgdbId] = useState("");
  const [isResolvingManualId, setIsResolvingManualId] = useState(false);
  const [parentNeeded, setParentNeeded] = useState<ParentNeeded | null>(null);
  const [cannotBeAddedOpen, setCannotBeAddedOpen] = useState(false);
  const linkGameToIgdb = useLinkGameToIgdb(gameId);
  const linkViaParent = useLinkGameToIgdbViaParent(gameId);
  const { data: localGames } = useGames();

  const isLinkingAddon = gameCategory !== null && ADDON_TYPE_CATEGORIES.includes(gameCategory);
  const allowedCategories = isLinkingAddon ? ADDON_TYPE_CATEGORIES : GAME_TYPE_CATEGORIES;

  useEffect(() => {
    if (open) {
      setQuery(gameName);
      setManualIgdbId("");
      setParentNeeded(null);
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
  const isPending = linkGameToIgdb.isPending || linkViaParent.isPending || isResolvingManualId;

  const handleLinkError = (error: unknown) => {
    console.error("Error linking game to IGDB:", error);
    const message =
      isAxiosError(error) && error.response?.status === 409
        ? "That IGDB game is already in your library."
        : "Error linking to IGDB. Please try again.";
    toast.error(message, TOAST_OPTIONS);
  };

  const handleLink = async (igdbId: number) => {
    try {
      await linkGameToIgdb.mutateAsync(igdbId);
      toast.success("Game linked to IGDB!", TOAST_OPTIONS);
      onClose();
    } catch (error) {
      handleLinkError(error);
    }
  };

  // Shared by both suggestion clicks and the manual-ID field: routes a resolved IGDB result
  // to the right outcome based on its category — link directly, check for/offer to import
  // its parent, or refuse.
  const resolveAndLink = (result: IgdbSearchResult) => {
    if (result.category !== null && GAME_TYPE_CATEGORIES.includes(result.category)) {
      void handleLink(result.igdbId);
      return;
    }
    if (result.category !== null && ADDON_TYPE_CATEGORIES.includes(result.category)) {
      if (!result.parentGame) {
        setCannotBeAddedOpen(true);
        return;
      }
      const parentExistsLocally = localGames?.some((game) => game.igdbId === result.parentGame!.igdbId);
      if (parentExistsLocally) {
        void handleLink(result.igdbId);
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
      toast.error("Enter a valid IGDB ID.", TOAST_OPTIONS);
      return;
    }
    setIsResolvingManualId(true);
    try {
      const results = await searchIgdb(`igdb:${igdbId}`);
      if (results.length === 0) {
        toast.error(`No IGDB game found with id "${igdbId}".`, TOAST_OPTIONS);
        return;
      }
      resolveAndLink(results[0]);
    } catch (error) {
      console.error("Error looking up IGDB id:", error);
      toast.error("Error looking up that IGDB ID. Please try again.", TOAST_OPTIONS);
    } finally {
      setIsResolvingManualId(false);
    }
  };

  const handleProceedWithParent = async () => {
    if (!parentNeeded) return;
    try {
      const game = await linkViaParent.mutateAsync(parentNeeded.addonIgdbId);
      toast.success("Parent game and addon added!", TOAST_OPTIONS);
      setParentNeeded(null);
      onClose();
      navigate(`/addon/${gameIdentifier(game)}`);
    } catch (error) {
      console.error("Error adding parent game:", error);
      toast.error("Error adding parent game. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Link to IGDB</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TextField
            label="Search IGDB"
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
              <Typography color="text.secondary">IGDB isn&apos;t configured on this server.</Typography>
            ) : isFetching ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : !isSearchActive ? (
              <Typography color="text.secondary">Keep typing to search IGDB.</Typography>
            ) : suggestions.length === 0 ? (
              <Typography color="text.secondary">No matches found.</Typography>
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
              label="IGDB ID"
              value={manualIgdbId}
              onChange={(event) => setManualIgdbId(event.target.value)}
              disabled={isPending}
              helperText="Know the exact IGDB id? Link to it directly."
            />
            <Button
              variant="outlined"
              onClick={() => void handleManualLink()}
              disabled={isPending || !manualIgdbId.trim()}
              sx={{ mt: 1 }}
            >
              Link
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={parentNeeded !== null}
        title="Parent game needed"
        description={
          parentNeeded
            ? `"${parentNeeded.parentName}" (IGDB #${parentNeeded.parentIgdbId}) needs to be added first. Add it now, along with all of its addons?`
            : ""
        }
        confirmLabel="Proceed"
        onClose={() => setParentNeeded(null)}
        onConfirm={() => void handleProceedWithParent()}
      />
      <MessageDialog
        open={cannotBeAddedOpen}
        title="Can't link to IGDB"
        message="This category cannot be added."
        onClose={() => setCannotBeAddedOpen(false)}
      />
    </>
  );
};

export default LinkToIgdbDialog;
