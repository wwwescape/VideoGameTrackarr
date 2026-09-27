import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import SearchIcon from "@mui/icons-material/Search";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { BulkImportJobStatus, GameCategory, GameSummary } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  useAcknowledgeBulkImportStatus,
  useBulkImportStatus,
  useGames,
  useImportGame,
} from "../hooks/useGames";
import { useIgdbSearch } from "../hooks/useIgdbSearch";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import BulkAddDialog from "./BulkAddDialog";
import GameCard from "./GameCard";
import GamesSubNav from "./GamesSubNav";
import ManualGameForm from "./ManualGameForm";
import SimpleTabPanel from "./SimpleTabPanel";
import VirtualGameGrid from "./VirtualGameGrid";
import { useSessionState } from "../hooks/useSessionState";

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
  // Keyword and tab are remembered for the session (see hooks/useSessionState.ts).
  const [searchKeyword, setSearchKeyword] = useSessionState("addGame.searchKeyword", "");
  const [rememberedMode, setMode] = useSessionState<AddMode>("addGame.mode", "igdb");
  // Landing here from Settings → Steam Sync's "Add as custom game" (see SteamSyncPage.tsx)
  // skips straight to the manual form, pre-filled — there's no IGDB entry to search for —
  // whatever tab was remembered, until the user switches tabs themselves.
  const [prefillForcesManual, setPrefillForcesManual] = useState(Boolean(steamPrefill));
  const mode: AddMode = prefillForcesManual ? "manual" : rememberedMode;
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

  // Polled only while this page is mounted (unlike restore's app-wide RestoreGuard) — a
  // bulk import only ever needs to affect the Add Game page itself, per explicit scoping.
  const { data: bulkImportStatus } = useBulkImportStatus(true);
  const acknowledgeBulkImportStatus = useAcknowledgeBulkImportStatus();
  const previousBulkImportStatus = useRef<BulkImportJobStatus | undefined>(undefined);
  const isBulkImportRunning = bulkImportStatus?.status === "running";

  useEffect(() => {
    const status = bulkImportStatus?.status;
    if (previousBulkImportStatus.current === "running" && status && status !== "running") {
      if (status === "completed" && bulkImportStatus?.result) {
        const { succeeded, failed } = bulkImportStatus.result;
        toast.success(
          t("games.add.bulkImportCompletedToast", { succeeded, failed }),
          TOAST_OPTIONS
        );
      } else if (status === "failed") {
        toast.error(t("games.add.bulkImportFailedToast"), TOAST_OPTIONS);
      }
      acknowledgeBulkImportStatus.mutate();
    }
    previousBulkImportStatus.current = status;
    // acknowledgeBulkImportStatus is a fresh object identity every render (useMutation) —
    // including it here would re-run this effect on every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkImportStatus?.status, bulkImportStatus?.result, t]);

  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);

  // Keyed by igdbId, not a local numeric id — these are IGDB search results, not yet
  // imported, so they have no local id to key by. The search bar is hidden entirely while
  // selectionMode is on (see the render body below), so there's no scenario where the
  // keyword changes mid-selection and this set would need reconciling against a new result
  // list — entering/exiting selection mode is the only thing that ever resets it.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIgdbIds, setSelectedIgdbIds] = useState<ReadonlySet<number>>(new Set());

  // Only a not-yet-added result can be selected — nothing to bulk-add for one already in the
  // library. No extra category gating needed here: a normal keyword search is already
  // restricted server-side to the same addable categories ADDABLE_CATEGORIES checks
  // (_BROWSABLE_GAME_TYPES in igdb_client.py) — that check only ever matters for the exact
  // "igdb:ID" search path, which short-circuits to idSearchCategoryBlocked before the grid
  // renders at all.
  const selectableResults = (searchResults ?? []).filter(
    (game) => !localGames?.some((local) => local.igdbId === game.igdbId)
  );
  const allVisibleSelected =
    selectableResults.length > 0 &&
    selectableResults.every((game) => selectedIgdbIds.has(game.igdbId));

  const handleGameClick = (game: GameSummary) => {
    navigate(`/game/${gameIdentifier(game)}`);
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIgdbIds(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIgdbIds(new Set());
  };

  const handleToggleSelectAll = () => {
    setSelectedIgdbIds(
      allVisibleSelected ? new Set() : new Set(selectableResults.map((game) => game.igdbId))
    );
  };

  const toggleResultSelected = (igdbId: number) => {
    setSelectedIgdbIds((prev) => {
      const next = new Set(prev);
      if (next.has(igdbId)) {
        next.delete(igdbId);
      } else {
        next.add(igdbId);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    setBulkAddDialogOpen(true);
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
      <GamesSubNav />
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
          onChange={(event) => {
            setPrefillForcesManual(false);
            setMode(event.target.value as AddMode);
          }}
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
            {isBulkImportRunning ? (
              <Grid size={12}>
                <Paper sx={{ p: 3, textAlign: "center" }}>
                  {t("games.add.bulkImportInProgressMessage")}
                </Paper>
              </Grid>
            ) : (
              <>
            <Grid size={12}>
              <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
                {selectionMode ? (
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <IconButton
                      onClick={handleExitSelectionMode}
                      aria-label={t("games.listToolbar.exitSelectionModeAriaLabel")}
                    >
                      <CloseIcon />
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      {t("games.listToolbar.selectedCount", { count: selectedIgdbIds.size })}
                    </Typography>
                    <Tooltip
                      title={
                        allVisibleSelected
                          ? t("games.listToolbar.deselectAllTooltip")
                          : t("games.listToolbar.selectAllTooltip")
                      }
                    >
                      <IconButton
                        onClick={handleToggleSelectAll}
                        aria-label={
                          allVisibleSelected
                            ? t("games.listToolbar.deselectAllAriaLabel")
                            : t("games.listToolbar.selectAllAriaLabel")
                        }
                        aria-pressed={allVisibleSelected}
                        disabled={selectableResults.length === 0}
                        color={allVisibleSelected ? "primary" : "default"}
                        sx={{ bgcolor: allVisibleSelected ? "action.selected" : undefined }}
                      >
                        <DoneAllIcon />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      disabled={selectedIgdbIds.size === 0}
                      onClick={handleAddSelected}
                    >
                      {t("games.add.addSelectedButton")}
                    </Button>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1}>
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
                    <Tooltip title={t("games.listToolbar.selectGames")}>
                      <IconButton
                        onClick={handleEnterSelectionMode}
                        aria-label={t("games.listToolbar.selectGames")}
                        disabled={selectableResults.length === 0}
                        sx={{ alignSelf: "center" }}
                      >
                        <CheckBoxOutlineBlankIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
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
                        onOpen={
                          addedGame ? undefined : () => navigate(`/games/add/igdb/${game.igdbId}`)
                        }
                        selectable={selectionMode && !addedGame}
                        selected={selectedIgdbIds.has(game.igdbId)}
                        onToggleSelect={() => toggleResultSelected(game.igdbId)}
                      />
                    );
                  }}
                />
              )}
            </Grid>
              </>
            )}
          </Grid>
        </SimpleTabPanel>
        <SimpleTabPanel value="manual" activeValue={mode} sx={{ py: 2 }}>
          <ManualGameForm initialValues={steamPrefill} steamAppId={steamPrefill?.steamAppId} />
        </SimpleTabPanel>
      </Box>
      <BulkAddDialog
        open={bulkAddDialogOpen}
        igdbIds={Array.from(selectedIgdbIds)}
        onClose={() => setBulkAddDialogOpen(false)}
      />
    </>
  );
};

export default AddGame;
