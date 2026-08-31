import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { useTranslation } from "react-i18next";
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

const MIN_SEARCH_LENGTH = 3;

type AddMode = "igdb" | "manual";

interface SteamPrefillState {
  steamPrefill?: {
    steamAppId?: number;
    name?: string;
    coverUrl?: string;
    summary?: string;
  };
}

// Matches backend's _IGDB_ID_QUERY_PATTERN (app/api/routes/igdb.py) — an exact-ID search
// returns at most one result, so it gets its own "wrong category" message instead of the
// generic "no games found".
const IGDB_ID_QUERY_PATTERN = /^igdb:\d+$/i;

// Addons (DLC/Addon, Expansion, Pack) need a parent already in the tracker to make sense —
// adding one directly here would create an orphaned top-level entry. Only these top-level-
// game categories are addable straight from a search result. Remake/Port are independently
// ownable/playable releases too (same bucket as Standalone Expansion/Bundle/Remaster), so
// they belong here alongside them, not with the addon categories.
const ADDABLE_CATEGORIES: GameCategory[] = [
  "main_game",
  "standalone_expansion",
  "expanded_game",
  "bundle",
  "remaster",
  "remake",
  "port",
];

function isAddableCategory(category: GameCategory | null): boolean {
  return category !== null && ADDABLE_CATEGORIES.includes(category);
}

const AddGame = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const steamPrefill = (location.state as SteamPrefillState | null)?.steamPrefill;
  const [searchKeyword, setSearchKeyword] = useState("");
  // Landing here from Insights → Steam Sync's "Add as custom game" (see SteamSyncPage.tsx)
  // skips straight to the manual form, pre-filled — there's no IGDB entry to search for.
  const [mode, setMode] = useState<AddMode>(steamPrefill ? "manual" : "igdb");
  const navigate = useNavigate();

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 1000);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce =
    trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

  const {
    data: searchResults,
    isFetching,
    error: searchError,
  } = useIgdbSearch(isSearchActive ? debouncedKeyword : "");
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
      toast.error(t("games.add.addGameError"), TOAST_OPTIONS);
    }
  };

  const igdbNotConfigured = isAxiosError(searchError) && searchError.response?.status === 503;
  const isIdSearch = IGDB_ID_QUERY_PATTERN.test(debouncedKeyword);
  const idSearchCategoryBlocked =
    isIdSearch &&
    !!searchResults &&
    searchResults.length > 0 &&
    !isAddableCategory(searchResults[0].category);

  return (
    <>
      {importGameMutation.isPending && (
        <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }} open>
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("games.add.pageTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("games.add.pageSubtitle")}
        </Typography>
      </Box>
      <Box sx={{ width: "100%", typography: "body1" }}>
        <RadioGroup
          row
          value={mode}
          onChange={(event) => setMode(event.target.value as AddMode)}
          sx={{ mb: 2 }}
        >
          <FormControlLabel value="igdb" control={<Radio />} label={t("games.add.fromIgdbLabel")} />
          <FormControlLabel
            value="manual"
            control={<Radio />}
            label={t("games.add.manuallyLabel")}
          />
        </RadioGroup>
        <SimpleTabPanel value="igdb" activeValue={mode} sx={{ px: 0, py: 2 }}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
                <TextField
                  label={t("games.add.searchLabel")}
                  variant="outlined"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder={t("games.add.searchPlaceholder")}
                  helperText={t("games.add.searchHelperText")}
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
                <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.add.igdbNotConfigured")}</Paper>
              ) : isSearching ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.add.searching")}</Paper>
              ) : !isSearchActive ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.add.pleaseSearchGames")}</Paper>
              ) : !searchResults || searchResults.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.add.noGamesFound")}</Paper>
              ) : idSearchCategoryBlocked ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>
                  {t("games.add.categoryCannotBeAdded")}
                </Paper>
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
                        contextFunction={() =>
                          addedGame ? handleGameClick(addedGame) : handleAddGame(game.igdbId)
                        }
                      />
                    );
                  }}
                />
              )}
            </Grid>
          </Grid>
        </SimpleTabPanel>
        <SimpleTabPanel value="manual" activeValue={mode} sx={{ py: 2 }}>
          <ManualGameForm initialValues={steamPrefill} steamAppId={steamPrefill?.steamAppId} />
        </SimpleTabPanel>
      </Box>
    </>
  );
};

export default AddGame;
