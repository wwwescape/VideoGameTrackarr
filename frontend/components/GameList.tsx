import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DeselectIcon from "@mui/icons-material/Deselect";
import EditIcon from "@mui/icons-material/Edit";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { useGameListState } from "../hooks/useGameListState";
import { useDeleteGame, useGames } from "../hooks/useGames";
import { useLibraryItems } from "../hooks/useLibrary";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { useSearchHandoff } from "../navigation/GlobalSearch";
import { gameIdentifier } from "../utils/identifiers";
import { matchesOwnership } from "../utils/ownershipFilter";
import GameCard, { GameCardHoverAction } from "./GameCard";
import { useGameListControls } from "./GameListControls";
import { CARD_SIZE_DEFAULT, GameCoverGrid, GameOverviewRows, GameTable, type GameListView } from "./GameListViews";
import ManageTagsDialog from "./ManageTagsDialog";
import Page, { ToolbarButton } from "./Page";
import PlayGameDialog from "./PlayGameDialog";
import { showUndoToast } from "./UndoToast";

const GameList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useGameListState("games", { sources: true });
  // Enter in the header search lands here with its text.
  useSearchHandoff("search", state.setSearchKeyword);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [playGame, setPlayGame] = useState<GameSummary | null>(null);
  // Display preferences, kept in this browser across visits (not just the session).
  const [view, setView] = useLocalPreference<GameListView>("games.view", "covers");
  const [cardSize, setCardSize] = useLocalPreference("games.cardSize", CARD_SIZE_DEFAULT);
  const controls = useGameListControls(state, { view, setView, cardSize, setCardSize });

  const { data: games, isLoading, isFetching } = useGames(state.apiFilters);
  const isSearching = state.isPendingDebounce || (state.isSearchActive && isFetching);

  const deleteGameMutation = useDeleteGame();
  const { schedule, isPending, delayMs } = useUndoableAction<GameSummary>({
    getId: (game) => game.id,
    onCommit: async (gamesToRemove) => {
      await Promise.all(gamesToRemove.map((game) => deleteGameMutation.mutateAsync(game.id)));
    },
  });

  const { statuses: ownershipStatuses, exclude: ownershipExclude, matchAll: ownershipMatchAll } = state.ownership;
  const filteredGames = useMemo(() => {
    if (!games) return [];
    // The Games list never shows a Collection/Series "what's missing" discovery that hasn't
    // been claimed yet — unconditionally, with no toggle to reveal it (unlike the Collection/
    // Series detail pages, where that's the whole point). A manually-added game that just
    // isn't owned/wishlisted yet is unaffected — it stays visible (greyscaled, no chip; see
    // GameCard.tsx) since it was never "missing" in that sense.
    let list = games.filter((game) => !(game.autoDiscovered && !game.owned && !game.wishlisted));
    if (ownershipStatuses.length > 0) {
      list = list.filter((game) => matchesOwnership(game, ownershipStatuses, ownershipExclude, ownershipMatchAll));
    }
    return list;
  }, [games, ownershipStatuses, ownershipExclude, ownershipMatchAll]);

  const visibleGames = useMemo(() => filteredGames.filter((game) => !isPending(game.id)), [filteredGames, isPending]);

  const handleGameClick = (game: GameSummary) => {
    navigate(`/game/${gameIdentifier(game)}`);
  };

  const toggleSelected = (gameId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // True once every currently-visible game is selected — drives both the toggle's next
  // action and its label. false (not true) when there's nothing visible to select, so an
  // empty list never shows the button as active.
  const allVisibleSelected = visibleGames.length > 0 && visibleGames.every((game) => selectedIds.has(game.id));

  const handleToggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleGames.map((game) => game.id)));
  };

  const handleBulkDelete = () => {
    const itemsToRemove = visibleGames.filter((game) => selectedIds.has(game.id));
    if (itemsToRemove.length === 0) {
      return;
    }
    const { undo } = schedule(itemsToRemove);
    setSelectionMode(false);
    setSelectedIds(new Set());
    showUndoToast(t("games.list.gamesRemovedToast", { count: itemsToRemove.length }), undo, delayMs);
  };

  const hoverActionsFor = (game: GameSummary) => {
    const actions = [];
    // Same conditions as the game page's own buttons: Edit is for custom games (IGDB games
    // are resynced, not edited), Play needs an owned copy with a ROM the emulator can run.
    if (game.igdbId === null) {
      actions.push(
        <GameCardHoverAction
          key="edit"
          icon={<EditIcon />}
          label={t("games.listView.edit")}
          onClick={() => navigate(`/game/${gameIdentifier(game)}/edit`)}
        />
      );
    }
    if (game.playable) {
      actions.push(
        <GameCardHoverAction key="play" icon={<PlayArrowIcon />} label={t("games.listView.play")} onClick={() => setPlayGame(game)} />
      );
    }
    return actions.length ? actions : undefined;
  };

  const normalToolbar = (
    <>
      <ToolbarButton primary icon={<AddIcon />} label={t("games.list.addGameButton")} onClick={() => navigate("/games/add")} />
      <ToolbarButton
        icon={<CheckBoxOutlinedIcon />}
        label={t("games.listView.select")}
        onClick={handleEnterSelectionMode}
        disabled={visibleGames.length === 0}
      />
    </>
  );
  const selectionToolbar = (
    <>
      <ToolbarButton icon={<CloseIcon />} label={t("games.listView.done")} onClick={handleExitSelectionMode} />
      <Box component="span" sx={{ px: 1, fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
        {t("games.listToolbar.selectedCount", { count: selectedIds.size })}
      </Box>
      <ToolbarButton
        icon={allVisibleSelected ? <DeselectIcon /> : <SelectAllIcon />}
        label={allVisibleSelected ? t("games.listToolbar.deselectAllTooltip") : t("games.listToolbar.selectAllTooltip")}
        onClick={handleToggleSelectAll}
        disabled={visibleGames.length === 0}
      />
    </>
  );
  const selectionToolbarEnd = (
    <>
      <ToolbarButton
        icon={<LabelOutlinedIcon />}
        label={t("games.listToolbar.manageTagsButton")}
        onClick={() => setManageTagsOpen(true)}
        disabled={selectedIds.size === 0}
      />
      <ToolbarButton
        danger
        icon={<DeleteOutlineIcon />}
        label={t("common.remove")}
        onClick={handleBulkDelete}
        disabled={selectedIds.size === 0}
      />
    </>
  );

  const emptyMessage = state.isSearchActive
    ? t("games.list.noGamesFound")
    : controls.activeFilterCount > 0
      ? t("games.list.noGamesMatchFilter")
      : t("games.list.pleaseAddGames");

  return (
    <Page
      meta={games ? t("games.listView.gameCount", { count: visibleGames.length }) : undefined}
      toolbar={selectionMode ? selectionToolbar : normalToolbar}
      toolbarEnd={selectionMode ? selectionToolbarEnd : controls.toolbarEnd}
      actions={controls.searchField}
    >
      {controls.chipRow}

      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : isSearching ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.list.searching")}</Paper>
      ) : visibleGames.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
      ) : view === "table" ? (
        <GameTable
          games={visibleGames}
          onOpen={handleGameClick}
          selecting={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          sort={state.sort}
          onSortChange={state.setSort}
        />
      ) : view === "overview" ? (
        <GameOverviewRows
          games={visibleGames}
          onOpen={handleGameClick}
          selecting={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
        />
      ) : (
        <GameCoverGrid
          games={visibleGames}
          cardSize={cardSize}
          showRail={state.sort === "name_asc"}
          renderCard={(game) => (
            <GameCard
              game={game}
              context="list"
              contextFunction={() => handleGameClick(game)}
              selectable={selectionMode}
              selected={selectedIds.has(game.id)}
              onToggleSelect={() => toggleSelected(game.id)}
              hoverActions={hoverActionsFor(game)}
            />
          )}
        />
      )}

      {controls.dialogs}
      <ManageTagsDialog open={manageTagsOpen} gameIds={Array.from(selectedIds)} onClose={() => setManageTagsOpen(false)} />
      {playGame ? <QuickPlay game={playGame} onClose={() => setPlayGame(null)} /> : null}
    </Page>
  );
};

// The hover Play shortcut opens the game page's own Play dialog; that needs the game's
// library copies (and their ROMs), fetched only when asked for.
const QuickPlay = ({ game, onClose }: { game: GameSummary; onClose: () => void }) => {
  const { data: libraryItems } = useLibraryItems(game.id);
  if (!libraryItems) return null;
  return <PlayGameDialog open gameName={game.name} libraryItems={libraryItems} onClose={onClose} />;
};

export default GameList;
