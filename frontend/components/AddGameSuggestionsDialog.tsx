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
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames, useImportGame } from "../hooks/useGames";
import { useIgdbSearch } from "../hooks/useIgdbSearch";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import GameCard from "./GameCard";

const MIN_SEARCH_LENGTH = 4;

interface AddGameSuggestionsDialogProps {
  open: boolean;
  name: string;
  onContinueManually: () => void;
  onClose: () => void;
}

// Shown when the user submits the "Manually" tab — a last check that the game isn't
// already on IGDB (which gets cover art, genres, platforms, etc. for free) before creating
// a bare-bones custom record. Mirrors LinkToIgdbDialog's layout, but suggestions import a
// brand new game rather than linking an existing one.
const AddGameSuggestionsDialog = ({ open, name, onContinueManually, onClose }: AddGameSuggestionsDialogProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState(name);
  const importGameMutation = useImportGame();
  const { data: localGames } = useGames();

  useEffect(() => {
    if (open) {
      setQuery(name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name]);

  const debouncedQuery = useDebouncedValue(query.trim(), 500);
  const isSearchActive = debouncedQuery.length >= MIN_SEARCH_LENGTH;
  const { data: searchResults, isFetching, error: searchError } = useIgdbSearch(isSearchActive ? debouncedQuery : "");
  const suggestions = searchResults ?? [];
  const igdbNotConfigured = isAxiosError(searchError) && searchError.response?.status === 503;

  const handleImport = async (igdbId: number) => {
    try {
      const game = await importGameMutation.mutateAsync(igdbId);
      toast.success("Game added!", TOAST_OPTIONS);
      onClose();
      navigate(`/game/${gameIdentifier(game)}`);
    } catch (error) {
      console.error("Error adding game:", error);
      toast.error("Error adding game. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Is this game already on IGDB?</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
          Adding from IGDB gets you cover art, genres, platforms, and more for free. Double-check before adding
          &quot;{name}&quot; as a custom game.
        </Typography>
        <TextField
          label="Search IGDB"
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={importGameMutation.isPending}
          sx={{ flexShrink: 0 }}
        />

        {/* Only this region scrolls — the search field above and the dialog actions below
            stay in view regardless of how many suggestions come back. minHeight: 0 is
            load-bearing: flex items default to a content-based min-height, which would
            otherwise stop this from ever shrinking smaller than its content. */}
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
              {suggestions.map((result) => {
                const addedGame = localGames?.find((game) => game.igdbId === result.igdbId);
                return (
                  <GameCard
                    key={result.igdbId}
                    game={result}
                    context={addedGame ? "added" : "add"}
                    contextFunction={() =>
                      addedGame ? navigate(`/game/${gameIdentifier(addedGame)}`) : handleImport(result.igdbId)
                    }
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importGameMutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onContinueManually} disabled={importGameMutation.isPending}>
          Continue to add game manually
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddGameSuggestionsDialog;
