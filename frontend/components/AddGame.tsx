import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { GameCategory, GameSummary } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames, useImportGame } from "../hooks/useGames";
import { useIgdbSearch } from "../hooks/useIgdbSearch";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import GameCard from "./GameCard";
import ManualGameForm from "./ManualGameForm";
import SimpleTabPanel from "./SimpleTabPanel";
import VirtualGameGrid from "./VirtualGameGrid";

const MIN_SEARCH_LENGTH = 4;

type AddMode = "igdb" | "manual";

// Matches backend's _IGDB_ID_QUERY_PATTERN (app/api/routes/igdb.py) — an exact-ID search
// returns at most one result, so it gets its own "wrong category" message instead of the
// generic "no games found".
const IGDB_ID_QUERY_PATTERN = /^igdb:\d+$/i;

// Addons (DLC/Addon, Expansion, Pack) need a parent already in the tracker to make sense —
// adding one directly here would create an orphaned top-level entry. Only these top-level-
// game categories are addable straight from a search result.
const ADDABLE_CATEGORIES: GameCategory[] = ["main_game", "standalone_expansion", "expanded_game", "bundle", "remaster"];

function isAddableCategory(category: GameCategory | null): boolean {
  return category !== null && ADDABLE_CATEGORIES.includes(category);
}

const AddGame = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [mode, setMode] = useState<AddMode>("igdb");
  const navigate = useNavigate();

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 1000);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce = trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

  const { data: searchResults, isFetching, error: searchError } = useIgdbSearch(
    isSearchActive ? debouncedKeyword : ""
  );
  const isSearching = isPendingDebounce || (isSearchActive && isFetching);

  const { data: localGames } = useGames();
  const importGameMutation = useImportGame();

  const handleGameClick = (game: GameSummary) => {
    navigate(`/game/${gameIdentifier(game)}`);
  };

  const handleAddGame = async (igdbId: number) => {
    try {
      const game = await importGameMutation.mutateAsync(igdbId);
      navigate(`/game/${gameIdentifier(game)}`);
    } catch (error) {
      console.error("Error adding game:", error);
      toast.error("Error adding game. Please try again.", TOAST_OPTIONS);
    }
  };

  const igdbNotConfigured = isAxiosError(searchError) && searchError.response?.status === 503;
  const isIdSearch = IGDB_ID_QUERY_PATTERN.test(debouncedKeyword);
  const idSearchCategoryBlocked =
    isIdSearch && !!searchResults && searchResults.length > 0 && !isAddableCategory(searchResults[0].category);

  return (
    <>
      {importGameMutation.isPending && (
        <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }} open>
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Game
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Search IGDB and add titles to your local tracker.
        </Typography>
      </Box>
      <Box sx={{ width: "100%", typography: "body1" }}>
        <RadioGroup
          row
          value={mode}
          onChange={(event) => setMode(event.target.value as AddMode)}
          sx={{ mb: 2 }}
        >
          <FormControlLabel value="igdb" control={<Radio />} label="From IGDB" />
          <FormControlLabel value="manual" control={<Radio />} label="Manually" />
        </RadioGroup>
        <SimpleTabPanel value="igdb" activeValue={mode} sx={{ px: 0, py: 2 }}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
                <TextField
                  label="Search games on IGDB"
                  variant="outlined"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="Enter game name"
                  helperText='Know the exact IGDB id? Search "igdb:<id>" (e.g. igdb:3542) to jump straight to it.'
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon style={{ cursor: "pointer" }} />
                        </InputAdornment>
                      ),
                      endAdornment: searchKeyword && (
                        <InputAdornment position="end" onClick={() => setSearchKeyword("")}>
                          <ClearIcon style={{ cursor: "pointer" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  fullWidth
                />
              </Paper>
            </Grid>
            <Grid size={12}>
              {igdbNotConfigured ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>
                  IGDB isn&apos;t configured on this server. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in
                  its .env file.
                </Paper>
              ) : isSearching ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>Searching...</Paper>
              ) : !isSearchActive ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>Please search for some games</Paper>
              ) : !searchResults || searchResults.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>No games found</Paper>
              ) : idSearchCategoryBlocked ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>This category cannot be added</Paper>
              ) : (
                <VirtualGameGrid
                  items={searchResults}
                  getKey={(game) => game.igdbId}
                  renderItem={(game) => {
                    const addedGame = localGames?.find((g) => g.igdbId === game.igdbId);
                    return (
                      <GameCard
                        game={game}
                        context={addedGame ? "added" : "add"}
                        contextFunction={() => (addedGame ? handleGameClick(addedGame) : handleAddGame(game.igdbId))}
                      />
                    );
                  }}
                />
              )}
            </Grid>
          </Grid>
        </SimpleTabPanel>
        <SimpleTabPanel value="manual" activeValue={mode} sx={{ py: 2 }}>
          <ManualGameForm />
        </SimpleTabPanel>
      </Box>
    </>
  );
};

export default AddGame;
